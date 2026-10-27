// Fotos do lugar.
// 1) Fotos já presentes na resposta /maps/preview/place (sem login o Google mostra uma
//    "visualização limitada" com dezenas de fotos).
// 2) Galeria paginada via /maps/rpc/photo/listentityphotos,
//    que devolve a galeria completa quando a sessão do navegador está logada numa conta Google.

import fs from 'node:fs';
import path from 'node:path';
import { obterTexto } from './cliente.js';
import { fetchPublico } from '../rede-segura.js';
import { pegar, ampliarImagem } from './busca.js';

const MEIO =
  '!5b1!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2' +
  '!1m3!1e10!2b0!3e4!1m3!1e9!2b1!3e2!2b1!9b0!15m8!1m7!1m2!1m1!1e2!2m2!1i195!2i195!3i200!16m2!2b1!4e1';

function montarUrl(dataId, kgmid, token, idioma, regiao) {
  const pagina = token ? `!5m51!2m2!1i203!2i100!3m3!2i200!3s${token}` : '!5m50!2m2!1i203!2i100!3m2!2i200';
  return `https://www.google.com/maps/rpc/photo/listentityphotos?authuser=0&hl=${idioma}&gl=${regiao || 'us'}` +
    `&pb=!1e2!3m5!1s${encodeURIComponent(dataId)}!9e0!15m2!1m1!4s${encodeURIComponent(kgmid || '')}${pagina}${MEIO}`;
}

function dataDaFoto(f) {
  for (const d of [pegar(f, 21, 6, 8), pegar(f, 21, 6, 8)]) {
    if (Array.isArray(d) && d.length >= 4) return new Date(Date.UTC(d[0], d[1] - 1, d[2], d[3])).toISOString().replace(/\.\d{3}Z$/, '');
  }
  return null;
}

// Um item de foto do Google tem: [0]=id, [6]=[url, "", [largura, altura], ...], [21]=metadados.
function ehItemDeFoto(a) {
  return Array.isArray(a) && typeof a[0] === 'string' && a[0].length > 10 && Array.isArray(a[6]) &&
    typeof a[6][0] === 'string' && /googleusercontent|streetviewpixels/.test(a[6][0]);
}

function converter(f) {
  const bruto = f[6][0];
  const streetView = bruto.includes('streetviewpixels');
  const dim = Array.isArray(f[6][2]) ? f[6][2] : pegar(f, 21, 2, 2);
  const origem = pegar(f, 21, 6, 5, 2);
  return {
    id: f[0],
    link: streetView ? bruto : ampliarImagem(bruto),
    tipo: streetView ? 'street_view' : 'foto',
    largura: Array.isArray(dim) ? dim[0] : null,
    altura: Array.isArray(dim) ? dim[1] : null,
    origem: typeof origem === 'string' ? origem : null,
    publicada_em: dataDaFoto(f),
  };
}

// Procura itens de foto em qualquer ponto de uma resposta do Google.
export function fotosDoBruto(raiz) {
  const saida = [];
  const pilha = [raiz];
  while (pilha.length) {
    const x = pilha.pop();
    if (!Array.isArray(x)) continue;
    if (ehItemDeFoto(x)) { saida.push(converter(x)); continue; }
    for (let i = x.length - 1; i >= 0; i--) if (Array.isArray(x[i])) pilha.push(x[i]);
  }
  return saida;
}

export async function buscarFotos(lugar, { maximo = 20, incluirStreetView = false, idioma = 'pt-BR', regiao = 'br', sinal, aoLog, iniciais = [] } = {}) {
  const fotos = [];
  const vistos = new Set();
  const adicionar = (lista) => {
    for (const f of lista) {
      if (!incluirStreetView && f.tipo === 'street_view') continue;
      const chave = f.id || f.link.replace(/=.*$/, '');
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      fotos.push(f);
      if (maximo && fotos.length >= maximo) return true;
    }
    return false;
  };
  if (adicionar(iniciais)) return fotos;
  if (!lugar.data_id) return fotos;

  let token = null;
  for (let pagina = 0; pagina < 100; pagina++) {
    const texto = await obterTexto(montarUrl(lugar.data_id, lugar.kgmid, token, idioma, regiao), { sinal, aoLog, tentativas: 2 });
    const dados = JSON.parse(texto.split(")]}'")[1]);
    const novas = fotosDoBruto(dados?.[0] || []);
    if (adicionar(novas)) break;
    token = pegar(dados, 5);
    if (!token || !novas.length) break;
  }
  return fotos;
}

export async function baixarFotos(lugar, pasta, { sinal } = {}) {
  const nomeBase = String(lugar.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 50);
  const destino = path.join(pasta, `${nomeBase}_${(lugar.place_id || lugar.data_id || '').slice(-8).replace(/\W/g, '')}`);
  fs.mkdirSync(destino, { recursive: true });
  let n = 0;
  for (const f of lugar.fotos || []) {
    if (sinal?.aborted) break;
    try {
      const r = await fetchPublico(f.link, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) continue;
      const ext = (r.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
      const arquivo = path.join(destino, `${String(++n).padStart(3, '0')}.${ext}`);
      fs.writeFileSync(arquivo, Buffer.from(await r.arrayBuffer()));
      f.arquivo = path.relative(path.dirname(pasta), arquivo);
    } catch { /* foto indisponível */ }
  }
  return destino;
}
