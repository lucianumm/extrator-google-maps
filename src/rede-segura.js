// Downloads de URLs que vêm de terceiros (site da empresa, links de fotos) sem deixar o
// programa alcançar a rede local: endereços privados, loopback e link-local são recusados,
// inclusive em redirecionamentos. Sem isso, uma empresa cadastrada com site
// "http://127.0.0.1:3210/..." faria o extrator chamar a própria API ou a rede interna.
//
// Limite conhecido: o DNS é resolvido aqui e de novo no fetch; um servidor DNS malicioso
// poderia responder diferente na segunda vez (DNS rebinding). Não cobre esse caso.

import dns from 'node:dns/promises';
import net from 'node:net';

const bloqueados = new net.BlockList();
for (const [rede, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
]) bloqueados.addSubnet(rede, bits, 'ipv4');
for (const [rede, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) bloqueados.addSubnet(rede, bits, 'ipv6');

export function ipPrivado(ip) {
  const familia = net.isIP(ip);
  if (!familia) return true; // não é IP: por segurança, trata como bloqueado
  return bloqueados.check(ip, familia === 4 ? 'ipv4' : 'ipv6');
}

export class ErroUrlBloqueada extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ErroUrlBloqueada';
  }
}

export async function validarUrlPublica(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new ErroUrlBloqueada(`protocolo não permitido: ${u.protocol}`);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const enderecos = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!enderecos.length || enderecos.some((e) => ipPrivado(e.address))) {
    throw new ErroUrlBloqueada('endereço de rede interna não permitido');
  }
  return u;
}

// fetch que valida cada salto de redirecionamento (até `maxRedirecionamentos`).
export async function fetchPublico(url, opcoes = {}, maxRedirecionamentos = 5) {
  let atual = url;
  for (let salto = 0; salto <= maxRedirecionamentos; salto++) {
    await validarUrlPublica(atual);
    const resp = await fetch(atual, { ...opcoes, redirect: 'manual' });
    const destino = resp.headers.get('location');
    if (resp.status >= 300 && resp.status < 400 && destino) {
      atual = new URL(destino, atual).href;
      continue;
    }
    return resp;
  }
  throw new ErroUrlBloqueada('redirecionamentos demais');
}
