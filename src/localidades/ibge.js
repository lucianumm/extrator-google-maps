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
