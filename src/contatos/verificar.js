// Verificação de e-mails.
// Grátis: sintaxe, domínio descartável, registro MX/A no DNS e sondagem SMTP (RCPT TO) com
// detecção de "aceita tudo" (catch-all). Muitos provedores de internet residenciais bloqueiam a
// porta 25; nesse caso o resultado fica "desconhecido" e vale só a checagem de DNS.
// Opcional: MillionVerifier ou ZeroBounce com a chave do próprio usuário.

import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

const DESCARTAVEIS = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com',
  'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'emailondeck.com']);
const GENERICOS = /^(contato|contact|info|informacoes|atendimento|sac|comercial|vendas|sales|adm|administrativo|financeiro|faleconosco|ola|oi|hello|suporte|support)@/i;

const cacheMx = new Map();
const cacheCatchAll = new Map();
// Após 3 domínios seguidos sem resposta SMTP assume porta 25 bloqueada e pausa a sondagem por
// 10 minutos (depois tenta de novo, caso a rede tenha mudado).
let falhasSmtpSeguidas = 0;
let smtpPausadoAte = 0;
const smtpPausado = () => Date.now() < smtpPausadoAte;

async function servidoresMx(dominio) {
  if (cacheMx.has(dominio)) return cacheMx.get(dominio);
  let lista = [];
  try {
    lista = (await dns.resolveMx(dominio)).sort((a, b) => a.priority - b.priority).map((m) => m.exchange).filter(Boolean);
  } catch { /* sem MX */ }
  if (!lista.length) {
    try { if ((await dns.resolve4(dominio)).length) lista = [dominio]; } catch { /* sem A */ }
  }
  cacheMx.set(dominio, lista);
  return lista;
}

function conversaSmtp(host, emails, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const respostas = [];
    let etapa = 0, buffer = '';
    const comandos = ['EHLO verificador.local', 'MAIL FROM:<verificador@verificador.local>', ...emails.map((e) => `RCPT TO:<${e}>`), 'QUIT'];
    const sock = net.createConnection({ host, port: 25 });
    const fim = (r) => { sock.destroy(); resolve(r); };
    sock.setTimeout(timeoutMs, () => fim(null));
    sock.on('error', () => fim(null));
    sock.on('data', (d) => {
      buffer += d.toString();
      const linhas = buffer.split('\r\n');
      buffer = linhas.pop();
      for (const l of linhas) {
        if (!/^\d{3} /.test(l)) continue; // linhas "250-..." são continuação
        const codigo = Number(l.slice(0, 3));
        if (etapa === 0 && codigo !== 220) return fim(null);
        if (etapa >= 3 && etapa < 3 + emails.length) respostas.push(codigo);
        if (etapa >= comandos.length) return fim(respostas);
        sock.write(comandos[etapa] + '\r\n');
        etapa++;
      }
    });
    sock.on('end', () => fim(respostas.length ? respostas : null));
  });
}

async function sondarSmtp(email, dominio, mxs) {
  const aleatorio = `nao-existe-${crypto.randomBytes(5).toString('hex')}@${dominio}`;
  if (smtpPausado()) return null;
  for (const mx of mxs.slice(0, 2)) {
    const r = await conversaSmtp(mx, cacheCatchAll.has(dominio) ? [email] : [email, aleatorio]);
    if (!r || !r.length) continue;
    falhasSmtpSeguidas = 0;
    if (r.length > 1) cacheCatchAll.set(dominio, r[1] >= 200 && r[1] < 300);
    const codigo = r[0];
    if (codigo >= 200 && codigo < 300) return cacheCatchAll.get(dominio) ? 'catch_all' : 'aceito';
    if (codigo >= 500) return 'recusado';
    return 'temporario';
  }
  if (++falhasSmtpSeguidas >= 3) {
    falhasSmtpSeguidas = 0;
    smtpPausadoAte = Date.now() + 10 * 60_000;
  }
  return null;
}

async function viaMillionVerifier(email, chave) {
  const r = await fetch(`https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(chave)}&email=${encodeURIComponent(email)}&timeout=20`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  const mapa = { ok: 'valido', catch_all: 'arriscado', unknown: 'desconhecido', invalid: 'invalido', disposable: 'invalido' };
  return { status: mapa[j.result] ?? 'desconhecido', motivo: `MillionVerifier: ${j.result ?? j.error ?? '?'}` };
}

async function viaZeroBounce(email, chave) {
  const r = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(chave)}&email=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  const mapa = { valid: 'valido', invalid: 'invalido', 'catch-all': 'arriscado', unknown: 'desconhecido', spamtrap: 'invalido', abuse: 'arriscado', do_not_mail: 'invalido' };
  return { status: mapa[j.status] ?? 'desconhecido', motivo: `ZeroBounce: ${j.status ?? j.error ?? '?'}${j.sub_status ? ` (${j.sub_status})` : ''}` };
}

// servico: 'gratis' | 'millionverifier' | 'zerobounce'
export async function verificarEmail(email, { servico = 'gratis', chave = '', smtp = true } = {}) {
  email = String(email).trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(email)) return { email, status: 'invalido', motivo: 'sintaxe inválida' };
  const dominio = email.split('@')[1];
  if (DESCARTAVEIS.has(dominio)) return { email, status: 'invalido', motivo: 'domínio descartável' };
  const generico = GENERICOS.test(email);

  if (servico !== 'gratis' && chave) {
    try {
      const r = servico === 'zerobounce' ? await viaZeroBounce(email, chave) : await viaMillionVerifier(email, chave);
      return { email, ...r, generico };
    } catch (e) {
      return { email, status: 'desconhecido', motivo: `falha no serviço: ${e.message}`, generico };
    }
  }

  const mxs = await servidoresMx(dominio);
  if (!mxs.length) return { email, status: 'invalido', motivo: 'domínio sem servidor de e-mail (MX)', generico };
  if (!smtp) return { email, status: 'dominio_valido', motivo: 'domínio recebe e-mail (MX ok); caixa não testada', mx: mxs[0], generico };
  const s = await sondarSmtp(email, dominio, mxs);
  const tabela = {
    aceito: ['valido', 'servidor confirmou a caixa'],
    catch_all: ['arriscado', 'domínio aceita qualquer endereço (catch-all)'],
    recusado: ['invalido', 'servidor recusou a caixa'],
    temporario: ['desconhecido', 'servidor respondeu erro temporário'],
  };
  const [status, motivo] = tabela[s] ?? ['dominio_valido', smtpPausado()
    ? 'domínio recebe e-mail (MX ok); porta 25 bloqueada nesta rede — use MillionVerifier/ZeroBounce para testar a caixa'
    : 'domínio recebe e-mail (MX ok); servidor não confirmou a caixa'];
  return { email, status, motivo, mx: mxs[0], generico };
}

// Ordena e-mails por relevância comercial (domínio do site, endereços de contato; penaliza no-reply e RH).
export function recomendarEmails(emails, site, quantidade = 1) {
  let dominioSite = null;
  try { dominioSite = new URL(site).hostname.replace(/^www\./, ''); } catch { /* sem site */ }
  const gratis = /@(gmail|hotmail|outlook|live|yahoo|bol|uol|terra|icloud|ig)\./;
  const pontuar = (e) => {
    const [local, dom] = e.split('@');
    let p = 0;
    if (dominioSite && (dom === dominioSite || dominioSite.endsWith('.' + dom) || dom.endsWith('.' + dominioSite))) p += 4;
    if (/^(contato|comercial|vendas|atendimento|faleconosco|orcamento|orcamentos|sac|info|ola|reservas|agendamento)$/.test(local)) p += 3;
    if (gratis.test(e)) p += dominioSite ? 0 : 2;
    if (/no-?reply|naoresponda|privacidade|privacy|lgpd|dpo|abuse|postmaster|webmaster/.test(local)) p -= 10;
    if (/^(rh|curriculo|curriculos|vagas|trabalhe|jobs|carreiras|nfe|nf|fiscal)/.test(local)) p -= 3;
    return p;
  };
  return [...emails].sort((a, b) => pontuar(b) - pontuar(a)).filter((e) => pontuar(e) > -3).slice(0, quantidade);
}
