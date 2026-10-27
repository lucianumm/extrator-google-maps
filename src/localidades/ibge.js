// Localidades do Brasil a partir do IBGE (lista embutida em dados/ + malhas sob demanda).
// A base de municípios é local e as fronteiras vêm da API pública de malhas do IBGE.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import tls from 'node:tls';
import { RAIZ } from '../caminhos.js';

const DADOS = path.join(RAIZ, 'dados');
const CACHE_MALHAS = path.join(DADOS, 'cache', 'malhas');

export const estados = JSON.parse(fs.readFileSync(path.join(DADOS, 'estados.json'), 'utf8'));
export const municipios = JSON.parse(fs.readFileSync(path.join(DADOS, 'municipios.json'), 'utf8'));
const porId = new Map(municipios.map((m) => [String(m.id), m]));
const nomeEstado = new Map(estados.map((e) => [e.sigla, e.nome]));

export const normalizar = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

for (const m of municipios) m._n = normalizar(m.nome);

// Municípios criados depois de 2017 (ex.: Boa Esperança do Norte - MT) não têm mesorregião no IBGE,
// que trocou essa divisão pelas regiões imediatas/intermediárias. Herdam a mesorregião dos vizinhos
// da mesma região imediata; sem vizinho, ficam em "Outros municípios".
const mesoDaImediata = new Map();
for (const m of municipios) if (m.meso && m.imediata) mesoDaImediata.set(`${m.uf}|${m.imediata}`, m.meso);
for (const m of municipios) if (!m.meso) m.meso = mesoDaImediata.get(`${m.uf}|${m.imediata}`) ?? 'Outros municípios';

// O servidor do IBGE não envia o certificado intermediário (Sectigo DV R36);
// ele vai junto em dados/certs para a validação TLS funcionar normalmente.
const ca = [...tls.rootCertificates, fs.readFileSync(path.join(DADOS, 'certs', 'sectigo-dv-r36.pem'), 'utf8')];

function obterIbge(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { ca, timeout: 30000 }, (r) => {
        if (r.statusCode !== 200) return reject(new Error(`IBGE respondeu ${r.statusCode}`));
        const partes = [];
        r.on('data', (c) => partes.push(c));
        r.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
      })
      .on('error', reject)
      .on('timeout', function () { this.destroy(new Error('Tempo esgotado ao consultar o IBGE')); });
  });
}

// Distância de Levenshtein (quantas letras trocar/inserir/apagar), para sugerir correções.
export function distanciaEdicao(a, b) {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    anterior = atual;
  }
  return anterior[b.length];
}

export function rotuloMunicipio(m) {
  return `${m.nome} - ${m.uf}`;
}

export function obterMunicipio(id) {
  return porId.get(String(id)) ?? null;
}

export function buscarMunicipios(texto, { ufs = [], limite = 30 } = {}) {
  const q = normalizar(texto);
  let lista = ufs.length ? municipios.filter((m) => ufs.includes(m.uf)) : municipios;
  if (q) {
    const comeca = [], contem = [];
    for (const m of lista) {
      if (m._n.startsWith(q)) comeca.push(m);
      else if (m._n.includes(q)) contem.push(m);
    }
    lista = [...comeca, ...contem];
  }
  return lista.slice(0, limite).map((m) => ({ id: m.id, nome: m.nome, uf: m.uf, estado: nomeEstado.get(m.uf), meso: m.meso }));
}

export function municipiosDosEstados(ufs) {
  return municipios.filter((m) => ufs.includes(m.uf));
}

export function nomeDoEstado(uf) {
  return nomeEstado.get(uf) ?? null;
}

// "SP", "sp", "São Paulo" ou "sao paulo" -> "SP". "BR", "Brasil" ou "todos" -> todas as siglas.
export function resolverEstados(entradas = []) {
  const siglas = new Set(), desconhecidos = [];
  for (const e of entradas) {
    const n = normalizar(e);
    if (['br', 'brasil', 'todos', 'todos os estados'].includes(n)) { estados.forEach((x) => siglas.add(x.sigla)); continue; }
    const est = estados.find((x) => x.sigla.toLowerCase() === n || normalizar(x.nome) === n);
    est ? siglas.add(est.sigla) : desconhecidos.push(String(e));
  }
  return { siglas: [...siglas], desconhecidos };
}

// Aceita o código do IBGE (3509502) ou o nome: "Campinas - SP", "Campinas/SP", "Campinas, SP",
// "Campinas (SP)" ou só "Campinas" (quando não há outra cidade com o mesmo nome).
// Devolve { municipio } ou { erro } com uma dica de como corrigir.
export function resolverMunicipio(entrada) {
  if (/^\d{7}$/.test(String(entrada).trim())) {
    const m = obterMunicipio(String(entrada).trim());
    return m ? { municipio: m } : { erro: `código IBGE ${entrada} não existe` };
  }
  const texto = String(entrada ?? '').trim();
  const partes = texto.match(/^(.+?)\s*(?:-|,|\/|\()\s*([A-Za-z]{2})\)?$/);
  const nome = normalizar(partes ? partes[1] : texto);
  const uf = partes ? resolverEstados([partes[2]]).siglas[0] : null;
  const achados = municipios.filter((m) => m._n === nome && (!uf || m.uf === uf));
  if (achados.length === 1) return { municipio: achados[0] };
  if (achados.length > 1) {
    return { erro: `"${texto}" existe em ${achados.length} estados (${achados.map((m) => m.uf).join(', ')}); escreva com a UF, ex.: "${achados[0].nome} - ${achados[0].uf}"` };
  }
  let parecidos = buscarMunicipios(partes ? partes[1] : texto, { ufs: uf ? [uf] : [], limite: 3 }).map((m) => `${m.nome} - ${m.uf}`);
  if (!parecidos.length) { // erro de digitação: nomes com até 2 letras de diferença
    parecidos = municipios.filter((m) => (!uf || m.uf === uf) && Math.abs(m._n.length - nome.length) <= 2)
      .map((m) => [m, distanciaEdicao(m._n, nome)]).filter(([, d]) => d <= 2).sort((a, b) => a[1] - b[1])
      .slice(0, 3).map(([m]) => `${m.nome} - ${m.uf}`);
  }
  return { erro: `cidade "${texto}" não encontrada${parecidos.length ? ` (você quis dizer ${parecidos.join(', ')}?)` : ''}` };
}

export function regioesDoEstado(uf) {
  const meso = new Map();
  for (const m of municipios) if (m.uf === uf) meso.set(m.meso, (meso.get(m.meso) || 0) + 1);
  return [...meso.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

export function municipiosDaRegiao(uf, meso) {
  return municipios.filter((m) => m.uf === uf && m.meso === meso);
}

// Fronteira (GeoJSON) do município, com cache em disco.
export async function malhaMunicipio(id) {
  const arquivo = path.join(CACHE_MALHAS, `${id}.json`);
  if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const texto = await obterIbge(
    `https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${id}?formato=application/vnd.geo+json&qualidade=intermediaria`,
  );
  const geo = JSON.parse(texto);
  const geometria = geo.type === 'FeatureCollection' ? geo.features[0]?.geometry : geo.geometry ?? geo;
  if (!geometria) throw new Error(`Malha do município ${id} não encontrada`);
  fs.mkdirSync(CACHE_MALHAS, { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(geometria));
  return geometria;
}
