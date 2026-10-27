// Países e cidades do mundo para o modo "País" (base embutida em dados/, gerada do GeoNames por
// scripts/atualizar-dados-geo.js). Cada cidade: [nome, lat, lon, população, código da região].

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../caminhos.js';
import { normalizar } from './ibge.js';

const DADOS = path.join(RAIZ, 'dados');

export const paises = JSON.parse(fs.readFileSync(path.join(DADOS, 'paises.json'), 'utf8'));
const porCodigo = new Map(paises.map((p) => [p.codigo, p]));
const porNome = new Map(paises.map((p) => [normalizar(p.nome), p]));

let cidades = null; // carregado só quando o modo País é usado (~1,4 MB)
function cidadesDe(codigo) {
  cidades ??= JSON.parse(fs.readFileSync(path.join(DADOS, 'cidades-mundo.json'), 'utf8'));
  return cidades[codigo] || [];
}

// Aceita o código ISO ("PT", "pt") ou o nome em português ("Portugal", "estados unidos").
export function obterPais(entrada) {
  const texto = String(entrada ?? '').trim();
  return porCodigo.get(texto.toUpperCase()) ?? porNome.get(normalizar(texto)) ?? null;
}

// Converte nomes ou códigos de regiões (estados/províncias) do país nos códigos do GeoNames.
export function resolverRegioesPais(pais, entradas = []) {
  const codigos = [], desconhecidas = [];
  for (const e of entradas) {
    const n = normalizar(e);
    const achado = Object.entries(pais.regioes).find(([cod, nome]) => cod === String(e).trim() || normalizar(nome) === n);
    achado ? codigos.push(achado[0]) : desconhecidas.push(String(e));
  }
  return { codigos, desconhecidas };
}

// Raio aproximado da área urbana a partir da população (15 mil hab. ≈ 2 km, 1 milhão ≈ 12 km).
export function raioCidadeKm(populacao) {
  return Math.round(Math.min(30, Math.max(2, 0.012 * Math.sqrt(populacao || 0))) * 10) / 10;
}

// Cidades do país, das mais populosas para as menores.
//   regioes: limita a estes estados/províncias (nomes ou códigos)
//   maximo: quantas cidades (0 = todas)   populacaoMinima: descarta cidades menores
export function cidadesDoPais(entrada, { regioes = [], maximo = 20, populacaoMinima = 0 } = {}) {
  const pais = obterPais(entrada);
  if (!pais) return [];
  const { codigos } = resolverRegioesPais(pais, regioes);
  let lista = cidadesDe(pais.codigo);
  if (codigos.length) lista = lista.filter((c) => codigos.includes(c[4]));
  if (populacaoMinima > 0) lista = lista.filter((c) => c[3] >= populacaoMinima);
  if (maximo > 0) lista = lista.slice(0, maximo);
  return lista.map(([nome, lat, lon, populacao, regiao]) => ({
    nome, lat, lon, populacao, regiao: pais.regioes[regiao] ?? null, raio_km: raioCidadeKm(populacao),
  }));
}
