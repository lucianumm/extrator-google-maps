// Cliente HTTP para os endpoints internos do Google Maps.
// Comportamento adotado:
//   - cabeçalhos mínimos: accept */*, Referer https://www.google.com/, User-Agent de navegador
//   - ritmo global: ~0,6 s entre requisições (variável INTERVALO_MS), em qualquer paralelismo
//   - 429/5xx: respeita Retry-After; senão espera 30 s, 60 s… (backoff com jitter)
//   - a resposta vem prefixada por )]}' (proteção anti-JSON-hijacking)
// Quando o Google exige verificação ("sorry"/consentimento), a sessão pode ser renovada
// por um navegador real (ver sessao.js).

import { sessao, renovarSessao } from './sessao.js';

const STATUS_REPETIR = new Set([429, 500, 502, 503, 504]);

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export class ErroCancelado extends Error {
  constructor() {
    super('Tarefa cancelada');
    this.name = 'ErroCancelado';
  }
}

export class ErroBloqueio extends Error {
  constructor(msg) {
    super(msg || 'O Google pediu verificação (página "sorry" ou de consentimento)');
    this.name = 'ErroBloqueio';
  }
}

export function limparPrefixo(texto) {
  let t = texto.trim();
  for (const p of ['/*""*/', ")]}'"]) if (t.startsWith(p)) t = t.slice(p.length).trimStart();
  if (t.endsWith('/*""*/')) t = t.slice(0, -6).trimEnd();
  return t;
}

export function analisarJsonGoogle(texto) {
  let dados = JSON.parse(limparPrefixo(texto));
  // a busca às vezes vem embrulhada em {"d": ")]}'\n[...]"}
  if (dados && typeof dados.d === 'string') dados = JSON.parse(limparPrefixo(dados.d));
  return dados;
}

function bloqueado(resp, texto) {
  if (/\/sorry\/|consent\.google\./.test(resp.url)) return true;
  return resp.status === 429 && /unusual traffic|tráfego incomum|captcha/i.test(texto);
}

// Ritmo global: todas as requisições ao Google (de qualquer trabalhador ou tarefa) saem com
// pelo menos INTERVALO_MS (±25%) entre si, não importa o paralelismo configurado.
export const INTERVALO_MS = Math.max(0, Number(process.env.INTERVALO_MS) || 600);
let proximaSaida = 0;

async function aguardarVaga(sinal) {
  const agora = Date.now();
  const saida = Math.max(agora, proximaSaida);
  proximaSaida = saida + INTERVALO_MS * (0.75 + Math.random() * 0.5);
  if (saida > agora) await esperarCancelavel(saida - agora, sinal);
}

// Espera antes de tentar de novo: respeita Retry-After; senão backoff exponencial com jitter.
export function esperaDeNovaTentativa(resp, base, tentativa) {
  const retryAfter = Number(resp?.headers?.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10 * 60_000);
  return Math.round(base * 2 ** tentativa * (0.8 + Math.random() * 0.4));
}

export async function obterTexto(url, { sinal, tentativas = 3, esperaErro = 30000, aoLog, html = false } = {}) {
  let ultimoErro;
  let renovou = false;
  for (let i = 0; i < tentativas; i++) {
    if (sinal?.aborted) throw new ErroCancelado();
    try {
      await aguardarVaga(sinal);
      const resp = await fetch(url, {
        headers: {
          accept: html ? 'text/html,application/xhtml+xml' : '*/*',
          'accept-language': `${sessao.idioma || 'pt-BR'},pt;q=0.9`,
          Referer: 'https://www.google.com/',
          'User-Agent': sessao.userAgent,
          ...(sessao.cookies ? { Cookie: sessao.cookies } : {}),
        },
        signal: AbortSignal.any([AbortSignal.timeout(30000), ...(sinal ? [sinal] : [])]),
      });
      const texto = await resp.text();
      if (bloqueado(resp, texto)) {
        if (!renovou && sessao.usarNavegador) {
          renovou = true;
          aoLog?.('O Google pediu verificação; abrindo o navegador para renovar a sessão…');
          await renovarSessao({ aoLog });
          i--;
          continue;
        }
        throw new ErroBloqueio();
      }
      if (resp.status === 200) return texto;
      ultimoErro = new Error(`HTTP ${resp.status}`);
      if (!STATUS_REPETIR.has(resp.status)) throw ultimoErro;
      if (i < tentativas - 1) {
        const espera = esperaDeNovaTentativa(resp, esperaErro, i);
        aoLog?.(`Google respondeu ${resp.status}; aguardando ${Math.round(espera / 1000)} s antes de tentar de novo`);
        await esperarCancelavel(espera, sinal);
      }
    } catch (e) {
      if (sinal?.aborted) throw new ErroCancelado();
      if (e instanceof ErroBloqueio) throw e;
      ultimoErro = e;
      if (i < tentativas - 1) await esperarCancelavel(2000, sinal);
    }
  }
  throw ultimoErro;
}

async function esperarCancelavel(ms, sinal) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (sinal?.aborted) throw new ErroCancelado();
    await dormir(Math.min(500, fim - Date.now()));
  }
}

export async function obterJsonGoogle(url, opcoes) {
  return analisarJsonGoogle(await obterTexto(url, opcoes));
}
