// Regera as bases geográficas embutidas em dados/ (rodar só quando quiser atualizá-las):
//
//   node scripts/atualizar-dados-geo.js
//
//   - dados/paises.json        países (nome em português, idioma, continente, regiões/estados)
//   - dados/cidades-mundo.json cidades com 15 mil+ habitantes de cada país (GeoNames, CC BY 4.0)
//   - dados/municipios.json    acrescenta lat/lon (ponto interno da fronteira do IBGE) a cada município
//
// Fontes: https://download.geonames.org/export/dump/ e a API de malhas do IBGE.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import https from 'node:https';
import tls from 'node:tls';
import { RAIZ } from '../src/caminhos.js';
import { pontoNaGeometria } from '../src/geo/grade.js';

const DADOS = path.join(RAIZ, 'dados');
const GEONAMES = 'https://download.geonames.org/export/dump';
const ca = [...tls.rootCertificates, fs.readFileSync(path.join(DADOS, 'certs', 'sectigo-dv-r36.pem'), 'utf8')];

function baixar(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { ca, timeout: 120000, headers: { 'User-Agent': 'extrator-google-maps (atualizar-dados-geo)' } }, (r) => {
        if (r.statusCode !== 200) return reject(new Error(`${url} respondeu ${r.statusCode}`));
        const partes = [];
        r.on('data', (c) => partes.push(c));
        r.on('end', () => resolve(Buffer.concat(partes)));
      })
      .on('error', reject)
      .on('timeout', function () { this.destroy(new Error(`Tempo esgotado: ${url}`)); });
  });
}

// Extrai o primeiro arquivo de um .zip (o cities15000.zip tem um só) lendo o diretório central.
function primeiroArquivoDoZip(zip) {
  const fimDir = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const inicioDir = zip.readUInt32LE(fimDir + 16);
  const metodo = zip.readUInt16LE(inicioDir + 10);
  const tamanho = zip.readUInt32LE(inicioDir + 20);
  const local = zip.readUInt32LE(inicioDir + 42);
  const dados = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const bruto = zip.subarray(dados, dados + tamanho);
  return metodo === 0 ? bruto : zlib.inflateRawSync(bruto);
}

const linhasTsv = (texto) => texto.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
const arred = (x) => Math.round(x * 10000) / 10000;

async function paisesECidades() {
  console.log('Baixando países, regiões e cidades do GeoNames…');
  const [infoPaises, admin1, zip] = await Promise.all([
    baixar(`${GEONAMES}/countryInfo.txt`),
    baixar(`${GEONAMES}/admin1CodesASCII.txt`),
    baixar(`${GEONAMES}/cities15000.zip`),
  ]);
  const nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region' });

  const regioes = {};
  for (const [codigo, nome] of linhasTsv(admin1.toString('utf8'))) {
    const [pais, regiao] = codigo.split('.');
    (regioes[pais] ??= {})[regiao] = nome;
  }

  const cidades = {};
  for (const c of linhasTsv(primeiroArquivoDoZip(zip).toString('utf8'))) {
    const [, nome, , , lat, lon, , codigo, pais, , regiao, , , , populacao] = c;
    // PPLX = bairro/parte de outra cidade (ex.: "South Boston"); PPLH/PPLQ = histórico/abandonado
    if (['PPLX', 'PPLH', 'PPLQ', 'PPLW'].includes(codigo)) continue;
    (cidades[pais] ??= []).push([nome, arred(+lat), arred(+lon), +populacao || 0, regiao || '']);
  }
  for (const lista of Object.values(cidades)) lista.sort((a, b) => b[3] - a[3]);

  const paises = [];
  for (const p of linhasTsv(infoPaises.toString('utf8'))) {
    const [codigo, , , , nomeIngles, capital, , populacao, continente, , , , , , , idiomas] = p;
    if (!cidades[codigo]?.length) continue;
    const idioma = (idiomas || '').split(',')[0] || 'en';
    paises.push({
      codigo,
      nome: nomes.of(codigo) || nomeIngles,
      capital,
      continente,
      populacao: +populacao || 0,
      idioma,
      cidades: cidades[codigo].length,
      regioes: regioes[codigo] || {},
    });
  }
  paises.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  fs.writeFileSync(path.join(DADOS, 'paises.json'), JSON.stringify(paises));
  fs.writeFileSync(path.join(DADOS, 'cidades-mundo.json'), JSON.stringify(cidades));
  const total = Object.values(cidades).reduce((s, l) => s + l.length, 0);
  console.log(`  ${paises.length} países e ${total} cidades gravados.`);
}

// Ponto que fica DENTRO do município (o centroide de cidades em forma de "C" pode cair fora):
// tenta o centroide do maior polígono; se cair fora, usa o meio do trecho mais largo da linha
// horizontal que passa por ele.
function pontoInterno(geometria) {
  const polis = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  let maior = null, maiorArea = -1;
  for (const poli of polis) {
    const anel = poli[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const f = anel[j][0] * anel[i][1] - anel[i][0] * anel[j][1];
      a += f;
      cx += (anel[j][0] + anel[i][0]) * f;
      cy += (anel[j][1] + anel[i][1]) * f;
    }
    if (Math.abs(a) > maiorArea) {
      maiorArea = Math.abs(a);
      maior = { anel, lon: cx / (3 * a), lat: cy / (3 * a) };
    }
  }
  if (pontoNaGeometria(maior.lat, maior.lon, geometria)) return { lat: maior.lat, lon: maior.lon };
  const cortes = [];
  const { anel, lat } = maior;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if (yi > lat !== yj > lat) cortes.push(xi + ((lat - yi) * (xj - xi)) / (yj - yi));
  }
  cortes.sort((a, b) => a - b);
  let melhor = null;
  for (let k = 0; k + 1 < cortes.length; k += 2) {
    if (!melhor || cortes[k + 1] - cortes[k] > melhor[1] - melhor[0]) melhor = [cortes[k], cortes[k + 1]];
  }
  return melhor ? { lat, lon: (melhor[0] + melhor[1]) / 2 } : { lat: maior.lat, lon: maior.lon };
}

async function coordenadasMunicipios() {
  console.log('Baixando as fronteiras dos municípios do IBGE…');
  const geo = JSON.parse(
    (await baixar('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo%2Bjson')).toString('utf8'),
  );
  const pontos = new Map(geo.features.map((f) => [String(f.properties.codarea), pontoInterno(f.geometry)]));
  const arquivo = path.join(DADOS, 'municipios.json');
  const municipios = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  let sem = 0;
  for (const m of municipios) {
    const p = pontos.get(String(m.id));
    if (p) { m.lat = arred(p.lat); m.lon = arred(p.lon); } else sem++;
  }
  fs.writeFileSync(arquivo, JSON.stringify(municipios));
  console.log(`  ${municipios.length - sem} municípios com coordenadas${sem ? ` (${sem} sem fronteira no IBGE)` : ''}.`);
}

await paisesECidades();
await coordenadasMunicipios();
console.log('Pronto.');
