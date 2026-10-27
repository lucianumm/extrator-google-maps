// Decide se um lugar devolvido pelo Google está dentro da área pedida ("Somente resultados dentro da
// área/cidade escolhida"). O Google mistura resultados de cidades vizinhas e, às vezes, de outros
// estados ou países; cada consulta leva um `filtro` montado pelo planejador:
//
//   { pais }                       país do lugar (código ISO, ex.: "BR") tem de bater, quando conhecido
//   { geometria }                  coordenada do lugar dentro do polígono (grade, polígono, ponto + raio)
//   { centro, raioKm }             coordenada do lugar a até raioKm do centro (cidades do modo País)
//   { cidadeNorm, uf, estadoNorm } cidade e UF do endereço (busca rápida por município do IBGE)

import { pontoNaGeometria } from '../geo/grade.js';
import { normalizar } from '../localidades/ibge.js';

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mesma cidade E mesmo estado: evita aceitar "Bom Jesus - GO" numa busca por "Bom Jesus - PI"
// e endereços como "Rua Campinas, 50 - Goiânia - GO" numa busca por Campinas.
function mesmaCidade(l, f) {
  if (l.estado) {
    const e = normalizar(l.estado);
    if (e !== f.uf.toLowerCase() && e !== f.estadoNorm) return false;
  }
  if (l.cidade && normalizar(l.cidade) === f.cidadeNorm) return true;
  const alvo = escaparRegex(`${f.cidadeNorm} - ${f.uf.toLowerCase()}`);
  return new RegExp(`(^|[,-]\\s*)${alvo}(\\s*,|\\s*$|\\s+\\d)`).test(normalizar(l.endereco));
}

export function dentroDaArea(l, filtro) {
  if (!filtro) return true;
  if (filtro.pais && l.pais && String(l.pais).toUpperCase() !== filtro.pais) return false;
  const temCoordenada = l.latitude != null && l.longitude != null;
  if (filtro.geometria && temCoordenada) return pontoNaGeometria(l.latitude, l.longitude, filtro.geometria);
  if (filtro.centro && filtro.raioKm && temCoordenada) {
    return distanciaKm(filtro.centro.lat, filtro.centro.lon, l.latitude, l.longitude) <= filtro.raioKm;
  }
  if (filtro.cidadeNorm) return mesmaCidade(l, filtro);
  return true;
}
