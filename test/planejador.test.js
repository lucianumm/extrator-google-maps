import test from 'node:test';
import assert from 'node:assert/strict';
import { planejarConsultas, validarConfig, avisosDaConfig, resumirPlano } from '../src/tarefas/planejador.js';
import { dentroDaArea, distanciaKm } from '../src/tarefas/area.js';
import { resolverMunicipio, resolverEstados } from '../src/localidades/ibge.js';
import { obterPais, cidadesDoPais } from '../src/localidades/paises.js';
import { circulo } from '../src/geo/grade.js';

test('resolverMunicipio aceita código, "Cidade - UF", "Cidade/UF" e nome único', () => {
  assert.equal(resolverMunicipio(3509502).municipio.nome, 'Campinas');
  assert.equal(resolverMunicipio('Campinas - SP').municipio.id, 3509502);
  assert.equal(resolverMunicipio('campinas/sp').municipio.id, 3509502);
  assert.equal(resolverMunicipio('Goiânia, GO').municipio.uf, 'GO');
  assert.equal(resolverMunicipio('Goiania').municipio.uf, 'GO');
});

test('resolverMunicipio explica nome repetido e erro de digitação', () => {
  assert.match(resolverMunicipio('Bom Jesus').erro, /existe em \d+ estados.*PI/);
  assert.match(resolverMunicipio('Campinass - SP').erro, /não encontrada.*Campinas - SP/);
});

test('resolverEstados aceita sigla, nome e "Brasil"', () => {
  assert.deepEqual(resolverEstados(['sp', 'Goiás']).siglas, ['SP', 'GO']);
  assert.equal(resolverEstados(['Brasil']).siglas.length, 27);
  assert.deepEqual(resolverEstados(['XX']).desconhecidos, ['XX']);
});

test('busca rápida no Brasil vai centrada na cidade e filtra por cidade + UF', async () => {
  const [c] = await planejarConsultas({ tipos: ['Dentista'], modo_local: 'brasil', municipios: ['Bom Jesus - PI'] });
  assert.equal(c.consulta, 'Dentista em Bom Jesus - PI');
  assert.ok(c.lat < -8 && c.lat > -10 && c.lon < -43 && c.lon > -46, 'coordenada dentro do Piauí');
  assert.equal(c.filtro.uf, 'PI');
});

test('validarConfig junta todos os problemas numa mensagem só', () => {
  assert.throws(() => validarConfig({ modo_local: 'brasil', municipios: ['Bom Jesus', 'Cidade Inexistente - SP'] }), (e) => {
    assert.equal(e.faltou.length, 3);
    return true;
  });
  assert.throws(() => validarConfig({ tipos: ['x'], modo_local: 'marte' }), /modo_local/);
});

test('modo país: maiores cidades, regiões por nome, país do Google ajustado', async () => {
  assert.equal(obterPais('portugal').codigo, 'PT');
  assert.equal(obterPais('us').nome, 'Estados Unidos');
  const cidades = cidadesDoPais('US', { regioes: ['Florida'], maximo: 3 });
  assert.equal(cidades.length, 3);
  assert.ok(cidades.every((c) => c.regiao === 'Florida'));
  assert.ok(cidades[0].populacao >= cidades[1].populacao);

  const consultas = await planejarConsultas({ tipos: ['dentist'], modo_local: 'pais', pais: { codigo: 'US', regioes: ['Florida'], max_cidades: 3 }, idioma: 'auto' });
  assert.equal(consultas.length, 3);
  assert.equal(consultas[0].regiao, 'us');
  assert.equal(consultas[0].idioma, 'en-US');
  assert.equal(consultas[0].filtro.pais, 'US');
  assert.throws(() => validarConfig({ tipos: ['x'], modo_local: 'pais', pais: { codigo: 'US', regioes: ['Narnia'] } }), /Narnia/);
});

test('dentroDaArea: cidade + UF, país, raio e polígono', () => {
  const f = { cidadeNorm: 'campinas', uf: 'SP', estadoNorm: 'sao paulo' };
  assert.equal(dentroDaArea({ cidade: 'Campinas', estado: 'São Paulo' }, f), true);
  assert.equal(dentroDaArea({ cidade: 'Campinas', estado: 'GO' }, f), false, 'homônimo de outro estado');
  assert.equal(dentroDaArea({ endereco: 'Av. Brasil, 10 - Centro, Campinas - SP, 13010-000' }, f), true);
  assert.equal(dentroDaArea({ endereco: 'Rua Campinas, 50 - Setor Oeste, Goiânia - GO' }, f), false, 'rua com o nome da cidade');

  assert.equal(dentroDaArea({ pais: 'ES', latitude: 41.15, longitude: -8.61 }, { pais: 'PT' }), false);
  const raio = { pais: 'PT', centro: { lat: 41.15, lon: -8.61 }, raioKm: 10 };
  assert.equal(dentroDaArea({ pais: 'PT', latitude: 41.16, longitude: -8.62 }, raio), true);
  assert.equal(dentroDaArea({ pais: 'PT', latitude: 38.72, longitude: -9.14 }, raio), false);

  assert.equal(dentroDaArea({ latitude: -16.68, longitude: -49.25 }, { geometria: circulo(-16.68, -49.25, 1) }), true);
  assert.ok(Math.abs(distanciaKm(41.1485, -8.611, 38.7251, -9.1498) - 274) < 5, 'Porto–Lisboa ≈ 274 km');
});

test('avisosDaConfig sugere o campo certo e resumirPlano soma páginas', () => {
  assert.match(avisosDaConfig({ tipo: ['x'] })[0], /"tipos"/);
  assert.deepEqual(avisosDaConfig({ tipos: ['x'], modo_local: 'brasil' }), []);
  const r = resumirPlano([{ rotulo: 'a', maxPaginas: 20 }, { rotulo: 'b', maxPaginas: 2 }]);
  assert.equal(r.consultas, 2);
  assert.equal(r.requisicoes_min, 2);
  assert.equal(r.requisicoes_max, 22);
});

test('todo estado lista mesorregiões, inclusive municípios novos sem mesorregião no IBGE (MT)', async () => {
  const { estados, regioesDoEstado, obterMunicipio } = await import('../src/localidades/ibge.js');
  for (const e of estados) assert.ok(regioesDoEstado(e.sigla).every((r) => typeof r.nome === 'string' && r.total > 0), e.sigla);
  assert.equal(obterMunicipio(5101837).meso, 'Norte Mato-grossense'); // Boa Esperança do Norte, criado em 2024
});
