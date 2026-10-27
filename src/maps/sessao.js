// Sessão com o Google: User-Agent e cookies.
// Por padrão tudo é HTTP puro. Quando o Google pede verificação — ou quando o usuário quer
// entrar na própria conta Google para liberar a galeria completa de fotos — um navegador real
// (Edge ou Chrome já instalados, via playwright-core) é aberto VISÍVEL com um perfil próprio
// em dados/cache/perfil-navegador. O usuário conclui verificação/login na janela; os cookies
// resultantes passam a acompanhar as requisições.

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../caminhos.js';
import { escreverAtomico } from '../arquivo.js';
import { explicarErro } from '../erros.js';

const ARQUIVO = path.join(RAIZ, 'dados', 'cache', 'sessao.json');
const PERFIL = path.join(RAIZ, 'dados', 'cache', 'perfil-navegador');
const UA_PADRAO =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export const sessao = { userAgent: UA_PADRAO, cookies: '', idioma: 'pt-BR', usarNavegador: true, renovadaEm: null, logada: false };

try {
  Object.assign(sessao, JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')));
} catch { /* sem sessão salva */ }

function gravar() {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const { userAgent, cookies, renovadaEm, usarNavegador, logada } = sessao;
  // os cookies equivalem a uma sessão do Google: só o dono do arquivo deve conseguir lê-lo (POSIX)
  escreverAtomico(ARQUIVO, JSON.stringify({ userAgent, cookies, renovadaEm, usarNavegador, logada }, null, 2), { modo: 0o600 });
}

// Último erro de "entrar na conta"/"renovar sessão" (a ação roda em segundo plano; sem isto
// a falha só apareceria no terminal). A interface lê em /api/sessao.
let ultimoErro = null;

export function estadoSessao() {
  const { cookies, renovadaEm, usarNavegador, logada } = sessao;
  return { temCookies: !!cookies, renovadaEm, usarNavegador, logada, abrindo: !!emAndamento, ultimoErro };
}

export function configurarSessao(opcoes) {
  Object.assign(sessao, opcoes);
  gravar();
}

export function limparSessao() {
  sessao.cookies = '';
  sessao.userAgent = UA_PADRAO;
  sessao.renovadaEm = null;
  sessao.logada = false;
  gravar();
  fs.rmSync(PERFIL, { recursive: true, force: true });
}

let emAndamento = null;

async function abrirContexto() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw new Error('playwright-core não instalado (rode npm install)');
  }
  let ultimoErro;
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launchPersistentContext(PERFIL, {
        channel, headless: false, locale: sessao.idioma || 'pt-BR', viewport: null,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw new Error(`Não encontrei Edge nem Chrome instalados (${ultimoErro?.message?.split('\n')[0]})`);
}

async function guardar(contexto, pagina) {
  sessao.userAgent = (await pagina.evaluate(() => navigator.userAgent)).replace('Headless', '');
  const cookies = await contexto.cookies('https://www.google.com');
  sessao.cookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  sessao.logada = cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID');
  sessao.renovadaEm = new Date().toISOString();
  gravar();
}

// modo "verificar": espera o Maps carregar (o usuário resolve verificação/consentimento) e fecha.
// modo "login": abre a tela de login e espera o usuário FECHAR a janela.
export function renovarSessao({ aoLog, modo = 'verificar', tempoMaximoMs = modo === 'login' ? 900000 : 180000 } = {}) {
  if (!emAndamento) ultimoErro = null;
  emAndamento ??= (async () => {
    const contexto = await abrirContexto();
    try {
      const pagina = contexto.pages()[0] || (await contexto.newPage());
      if (modo === 'login') {
        await pagina.goto('https://accounts.google.com/ServiceLogin?continue=https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
        aoLog?.('Navegador aberto: entre na sua conta Google e depois FECHE a janela.');
        let ultimaPagina = pagina;
        const limite = Date.now() + tempoMaximoMs;
        while (Date.now() < limite && contexto.pages().length) {
          ultimaPagina = contexto.pages()[0];
          try { await guardar(contexto, ultimaPagina); } catch { /* janela fechando */ }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } else {
        await pagina.goto('https://www.google.com/maps/search/restaurantes?hl=pt-BR', { waitUntil: 'domcontentloaded' });
        aoLog?.('Navegador aberto. Se aparecer verificação ou consentimento do Google, conclua na janela.');
        const limite = Date.now() + tempoMaximoMs;
        while (Date.now() < limite) {
          const url = pagina.url();
          if (url.includes('/maps') && !/\/sorry\/|consent\./.test(url)) {
            await pagina.waitForTimeout(3000);
            break;
          }
          await pagina.waitForTimeout(1000);
        }
        if (!pagina.url().includes('/maps')) throw new Error('A verificação do Google não foi concluída a tempo');
        await guardar(contexto, pagina);
      }
      aoLog?.(`Sessão do Google ${sessao.logada ? 'logada' : 'renovada'}`);
    } finally {
      await contexto.close().catch(() => {});
    }
  })().then(
    () => { ultimoErro = null; },
    (e) => { ultimoErro = explicarErro(e); throw e; },
  ).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}
