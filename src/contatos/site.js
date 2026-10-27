// Coleta gratuita de e-mails e redes sociais no site da empresa.
// Procura e-mails e redes sociais nas páginas do site da empresa, sem serviços pagos.

import { fetchPublico } from '../rede-segura.js';

const UA ='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const REDES = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/|share)[A-Za-z0-9_.]+\/?/gi,
  facebook: /https?:\/\/(?:www\.|m\.|pt-br\.)?facebook\.com\/(?!sharer|share|plugins|tr\?|dialog|login)[A-Za-z0-9_.\-/?=]+/gi,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_\-%.]+\/?/gi,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_\-.]+/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/gi,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]{2,}/gi,
  whatsapp: /https?:\/\/(?:api\.whatsapp\.com\/send\/?\?phone=|wa\.me\/|web\.whatsapp\.com\/send\?phone=)\+?\d{8,15}/gi,
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g;
const EMAIL_FALSO = /\.(png|jpe?g|gif|svg|webp|avif|css|js)$|@([\w-]+\.)*(sentry[\w-]*|wixpress|example|exemplo|domain|dominio|email|linktr)\.|^(nome|seuemail|your|you|email|exemplo|example)@|^[0-9a-f]{24,}@|u00/i;
const PALAVRAS_CONTATO = /contato|contact|fale|atendimento|sobre|quem-somos|about|empresa/i;

async function baixar(url, timeoutMs) {
  const resp = await fetchPublico(url, {
    headers: { 'User-Agent': UA, accept: 'text/html,*/*', 'accept-language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const tipo = resp.headers.get('content-type') || '';
  if (!resp.ok || !tipo.includes('html')) return null;
  return { html: (await resp.text()).slice(0, 2_000_000), url: resp.url };
}

function links(html, base) {
  const saida = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === new URL(base).origin && PALAVRAS_CONTATO.test(u.pathname)) saida.add(u.href.split('#')[0]);
    } catch { /* link inválido */ }
  }
  return [...saida];
}

function extrair(html, acumulado) {
  const texto = html.replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@').replace(/%40/g, '@');
  for (const e of texto.match(EMAIL) || []) {
    const email = e.toLowerCase().replace(/^[^a-z0-9]+/, '');
    if (!EMAIL_FALSO.test(email)) acumulado.emails.add(email);
  }
  for (const [rede, re] of Object.entries(REDES)) {
    for (const l of html.match(re) || []) acumulado[rede].add(l.replace(/[\\"'<>]+$/, '').replace(/\/$/, ''));
  }
}

export async function coletarContatos(site, { paginasExtras = 3, timeoutMs = 15000 } = {}) {
  const acumulado = { emails: new Set(), ...Object.fromEntries(Object.keys(REDES).map((r) => [r, new Set()])) };
  const resultado = () => Object.fromEntries(Object.entries(acumulado).map(([k, v]) => [k, [...v].slice(0, 10)]));
  if (!site || !/^https?:/i.test(site)) return { ...resultado(), erro_contatos: null };

  const host = new URL(site).hostname;
  // Site que é a própria rede social: só registra o link.
  for (const rede of Object.keys(REDES)) {
    if (host.includes(rede === 'twitter' ? 'x.com' : `${rede}.com`) || (rede === 'whatsapp' && host.includes('wa.me'))) {
      acumulado[rede].add(site);
      return { ...resultado(), erro_contatos: null };
    }
  }
  try {
    const inicial = await baixar(site, timeoutMs);
    if (!inicial) return { ...resultado(), erro_contatos: 'site não retornou HTML' };
    extrair(inicial.html, acumulado);
    for (const url of links(inicial.html, inicial.url).slice(0, paginasExtras)) {
      try {
        const pagina = await baixar(url, timeoutMs);
        if (pagina) extrair(pagina.html, acumulado);
      } catch { /* página extra indisponível */ }
    }
    return { ...resultado(), erro_contatos: null };
  } catch (e) {
    return { ...resultado(), erro_contatos: e.name === 'TimeoutError' ? 'tempo esgotado' : e.message };
  }
}
