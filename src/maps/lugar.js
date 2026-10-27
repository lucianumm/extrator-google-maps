// Detalhes completos de um lugar via /maps/preview/place.
// A URL é lida do <link> de pré-carregamento que a própria página do lugar traz,
// e a resposta é pedida por HTTP. Inclui campos extras (horários de pico,
// concorrentes, pergunta frequente) que dependem da sessão logada.

import { obterTexto, analisarJsonGoogle } from './cliente.js';
import { analisarLugar, pegar, linkDoLugar, ampliarImagem } from './busca.js';
import { fotosDoBruto } from './fotos.js';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

function horariosDePico(p) {
  const dias = pegar(p, 84, 0) || [];
  const saida = {};
  for (const d of dias) {
    const horas = d?.[1];
    if (!Array.isArray(horas) || !horas.length) continue;
    saida[DIAS[d[0]] ?? String(d[0])] = horas.map((h) => ({ hora: h[0], ocupacao: h[1], descricao: h[2] || null, rotulo: h[4] || null }));
  }
  return Object.keys(saida).length ? saida : null;
}

function concorrentes(p) {
  const lista = pegar(p, 99, 0, 0, 1) || [];
  const saida = [];
  for (const item of lista) {
    const t = pegar(item, 1);
    if (!t || !t[11]) continue;
    const coords = Array.isArray(t[9]) ? t[9] : [];
    saida.push({
      nome: t[11],
      nota: pegar(t, 4, 7),
      avaliacoes: pegar(t, 4, 8),
      categorias: pegar(t, 13) || [],
      latitude: coords[coords.length - 2] ?? null,
      longitude: coords[coords.length - 1] ?? null,
      place_id: pegar(t, 78),
    });
  }
  return saida;
}

function capa(p) {
  const cand = [pegar(p, 72, 0, 1, 6, 0), pegar(p, 72, 0, 0, 6, 0), pegar(p, 51, 0, 6, 0)];
  const url = cand.find((x) => typeof x === 'string' && x.includes('googleusercontent'));
  return ampliarImagem(url);
}

function primeiraPergunta(p) {
  const q = pegar(p, 126, 0);
  if (!q) return null;
  return { pergunta: pegar(q, 0, 0, 2)?.trim() ?? null, resposta: pegar(q, 0, 1, 0, 2)?.trim() ?? null };
}

export function analisarDetalhes(p) {
  const base = analisarLugar(p);
  if (!base) return null;
  return {
    ...base,
    imagem: capa(p) || base.imagem,
    total_fotos: pegar(p, 51, 1) ?? pegar(p, 37, 1) ?? null,
    horarios_pico: horariosDePico(p),
    concorrentes: concorrentes(p),
    pergunta_frequente: primeiraPergunta(p),
    plus_code: pegar(p, 183, 2, 2, 0),
  };
}

export async function buscarDetalhes(lugar, { idioma = 'pt-BR', regiao = 'br', sinal, aoLog } = {}) {
  const alvo = lugar.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${lugar.place_id}&hl=${idioma}&gl=${regiao}`
    : `https://www.google.com/maps/place/data=!4m2!3m1!1s${lugar.data_id}?hl=${idioma}&gl=${regiao}`;
  const html = await obterTexto(alvo, { sinal, aoLog, html: true, tentativas: 2 });
  const href = html.match(/href="(\/maps\/preview\/place\?[^"]+)"/)?.[1];
  let p = null;
  if (href) {
    const dados = analisarJsonGoogle(await obterTexto('https://www.google.com' + href.replace(/&amp;/g, '&'), { sinal, aoLog, tentativas: 2 }));
    p = pegar(dados, 6);
  } else {
    // alternativa: dados embutidos em APP_INITIALIZATION_STATE (quando a página os traz)
    const estado = html.split(';window.APP_INITIALIZATION_STATE=')[1]?.split(';window.APP_FLAGS')[0];
    const bruto = estado ? pegar(JSON.parse(estado), 3, 6) : null;
    if (typeof bruto === 'string') p = pegar(analisarJsonGoogle(bruto), 6);
  }
  const det = p ? analisarDetalhes(p) : null;
  if (!det) return null;
  det.link = linkDoLugar(det);
  // fotos já presentes na resposta (não são gravadas; usadas pela etapa de fotos)
  Object.defineProperty(det, 'fotosPrevia', { value: fotosDoBruto(p), enumerable: false });
  return det;
}

// Mescla mantendo o que já existe quando o detalhe vier vazio.
export function mesclarDetalhes(lugar, det) {
  for (const [k, v] of Object.entries(det)) {
    const vazio = v == null || (Array.isArray(v) && !v.length) || v === '';
    if (!vazio || lugar[k] === undefined) lugar[k] = v;
  }
  return lugar;
}
