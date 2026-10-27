import test from 'node:test';
import assert from 'node:assert/strict';
import { explicarErro, ErroValidacao } from '../src/erros.js';
import { validarConfig } from '../src/tarefas/planejador.js';

const bloqueio = Object.assign(new Error('x'), { name: 'ErroBloqueio' });

test('explicarErro: toda explicação tem título, causa, solução e detalhe técnico', () => {
  const casos = [
    bloqueio,
    new Error('HTTP 429'), new Error('HTTP 403'), new Error('HTTP 503'), new Error('HTTP 418'),
    new Error('playwright-core não instalado (rode npm install)'),
    new Error('Não encontrei Edge nem Chrome instalados (x)'),
    new Error('A verificação do Google não foi concluída a tempo'),
    new Error('Apollo 401: invalid'), new Error('Apollo 429: limit'),
    Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }),
    Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    Object.assign(new Error('t'), { name: 'TimeoutError' }),
    Object.assign(new Error('unable to verify'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }),
    new Error('IBGE respondeu 500'),
    new SyntaxError('Unexpected token'),
    Object.assign(new Error('no space'), { code: 'ENOSPC' }),
    new Error('qualquer coisa'),
  ];
  for (const c of casos) {
    const d = explicarErro(c);
    for (const k of ['titulo', 'causa', 'solucao', 'tecnico']) assert.ok(d[k] && typeof d[k] === 'string', `${c.message} sem ${k}`);
  }
});

test('explicarErro escolhe a explicação certa', () => {
  assert.match(explicarErro(bloqueio).titulo, /verificação/);
  assert.match(explicarErro(new Error('HTTP 429')).titulo, /429/);
  assert.match(explicarErro(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })).titulo, /internet/);
  assert.match(explicarErro(new Error('playwright-core não instalado')).solucao, /npm install/);
  assert.match(explicarErro(new Error('???')).titulo, /inesperado/);
});

test('explicarErro repassa a lista do que faltou nos erros de validação', () => {
  const d = explicarErro(new ErroValidacao('msg', { faltou: ['a', 'b'] }));
  assert.deepEqual(d.faltou, ['a', 'b']);
});

test('validarConfig junta tudo o que falta numa mensagem só', () => {
  assert.throws(() => validarConfig({ modo_local: 'brasil', tipos: [] }), (e) => {
    assert.equal(e.name, 'ErroValidacao');
    assert.equal(e.faltou.length, 2);
    assert.match(e.message, /tipo de negócio/);
    assert.match(e.message, /estado, região ou município/);
    return true;
  });
  assert.throws(() => validarConfig({ modo_local: 'ponto', tipos: ['x'], ponto: { lat: null, lon: 200 } }), /latitude/);
  assert.throws(() => validarConfig({ modo_local: 'poligono', tipos: ['x'], poligono: 'não é json' }), /GeoJSON/);
  assert.throws(() => validarConfig({ modo_local: 'links', links: ['https://exemplo.com'] }), /não é um link do Google Maps/);
  assert.throws(() => validarConfig({}), /onde buscar/);
});

test('validarConfig aceita configurações completas', () => {
  validarConfig({ modo_local: 'brasil', tipos: ['Dentista'], municipios: [5208707] });
  validarConfig({ modo_local: 'ponto', tipos: ['Dentista'], ponto: { lat: -16.68, lon: -49.25 } });
  validarConfig({ modo_local: 'links', links: ['https://www.google.com/maps/search/dentista+em+goiania'] });
  validarConfig({ modo_local: 'livre', tipos: ['x'], locais_livres: [{ descricao: 'Campinas' }] });
});
