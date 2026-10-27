// Busca de lugares no Google Maps via endpoint interno /search?tbm=map.
// O formato do parâmetro "pb" e os índices dos campos foram observados nas respostas do Google
// e podem mudar sem aviso; o diagnóstico (diagnostico.js) detecta quando isso acontece.

import { obterJsonGoogle } from './cliente.js';

export const TAMANHO_PAGINA = 20;

// Acesso seguro a arrays aninhados (índice negativo conta a partir do fim).
export function pegar(obj, ...caminho) {
  let atual = obj;
  for (const chave of caminho) {
    if (atual == null) return null;
    atual = typeof chave === 'number' && chave < 0 && Array.isArray(atual) ? atual[atual.length + chave] : atual[chave];
  }
  return atual ?? null;
}

export function montarUrlBusca({ consulta, lat = 0, lon = 0, zoom = 13, deslocamento = 0, idioma = 'pt-BR', regiao = 'br' }) {
  const pb =
    `!4m12!1m3!1d3826.902183192154!2d${Number(lon).toFixed(4)}!3d${Number(lat).toFixed(4)}` +
    `!2m3!1f0!2f0!3f0!3m2!1i600!2i800!4f${zoom}!7i${TAMANHO_PAGINA}!8i${deslocamento}` +
    '!10b1!12m22!1m3!18b1!30b1!34e1!2m3!5m1!6e2!20e3!4b0!10b1!12b1!13b1!16b1!17m1!3e1' +
    '!20m3!5e2!6b1!14b1!46m1!1b0!96b1!19m4!2m3!1i360!2i120!4i8';
  const params = new URLSearchParams({ tbm: 'map', authuser: '0', hl: idioma, ...(regiao ? { gl: regiao } : {}), q: consulta, pb });
  return `https://www.google.com/search?${params}`;
}

export function linkDoLugar(lugar) {
  if (lugar.place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar.nome)}&query_place_id=${lugar.place_id}`;
  }
  if (lugar.latitude != null) return `https://www.google.com/maps/@${lugar.latitude},${lugar.longitude},18z`;
  return null;
}

function achatar(arr) {
  return arr.reduce((acc, x) => (Array.isArray(x) ? acc.concat(achatar(x)) : x != null ? acc.concat(x) : acc), []);
}

function extrairDescricao(p) {
  const blocos = (pegar(p, 32) ?? []).filter(Array.isArray).reverse();
  for (const bloco of blocos) {
    for (const item of [...bloco].reverse()) {
      if (Array.isArray(item)) {
        const textos = achatar(item).filter((x) => typeof x === 'string');
        if (textos.length) return textos.join('\n');
      }
      if (typeof item === 'string') return item;
    }
  }
  return pegar(p, 154, 0, 0);
}

function extrairHorarios(p) {
  let dias = pegar(p, 203, 0) || [];
  if (!dias.length) dias = pegar(p, 34, 1) || [];
  const saida = [];
  for (const d of dias) {
    if (!Array.isArray(d) || typeof d[0] !== 'string') continue;
    let horas = [];
    if (Array.isArray(d[3]) && d[3].length) {
      for (const h of d[3]) if (Array.isArray(h) && typeof h[0] === 'string') horas.push(h[0]);
    } else if (Array.isArray(d[1])) {
      horas = d[1].filter((x) => typeof x === 'string');
    }
    if (horas.length) saida.push({ dia: d[0], horarios: horas });
  }
  return saida;
}

function extrairSobre(p) {
  return (pegar(p, 100, 1) || []).map((grupo) => ({
    grupo: grupo[1],
    itens: (grupo[2] || []).map((o) => ({ nome: o[1], disponivel: (pegar(o, 2, 1, 0, 0) ?? pegar(o, 4, 0)) !== 0 })),
  }));
}

function limparLinkGoogle(link) {
  if (!link) return link;
  const i = link.indexOf('&opi');
  if (i !== -1) link = link.slice(0, i);
  if (link.startsWith('/url?q=')) link = decodeURIComponent(link.slice(7));
  return link;
}

function podeReivindicar(p) {
  const link = pegar(p, 226, 0);
  if (typeof link === 'string' && link.replace(/\/$/, '').endsWith('setup/create')) return true;
  const texto = pegar(p, 49, 1);
  return typeof texto === 'string' && /(^|\s)(claim|reivindi)/i.test(texto);
}

// Amplia miniaturas do googleusercontent para 1920 px.
export function ampliarImagem(url) {
  if (!url) return null;
  if (url.startsWith('//')) url = 'https:' + url;
  if (/=s\d+-c/.test(url)) return url.replace(/=s\d+-c.*/, '=s1920');
  if (/=s\d+/.test(url)) return url.replace(/=s\d+/, '=s1920');
  if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+[^&]*/, '=w1920-h1080');
  return url;
}

function extrairImagem(p) {
  const candidatos = [pegar(p, 72, 0, 1, 6, 0), pegar(p, 72, 0, 0, 6, 0), pegar(p, 51, 0, 0, 6, 0)];
  const url = candidatos.find((x) => typeof x === 'string' && x.includes('googleusercontent'));
  return ampliarImagem(url);
}

// Converte o array bruto de um lugar (resposta[0][1][i][14]) em objeto legível.
export function analisarLugar(p) {
  const nome = pegar(p, 11);
  if (!nome) return null;
  const categorias = (pegar(p, 13) || []).map(String);
  const end = pegar(p, 183, 1);
  const tel = pegar(p, 178, 0, 0);
  const horarios = extrairHorarios(p);
  const distribuicao = pegar(p, 175, 3);
  const dono = pegar(p, 57, 2) ?? pegar(p, 57, 8);

  return {
    place_id: pegar(p, 78),
    data_id: pegar(p, 10),
    kgmid: pegar(p, 89),
    nome,
    descricao: extrairDescricao(p),
    categoria_principal: categorias[0] ?? null,
    categorias,
    nota: pegar(p, 4, 7),
    avaliacoes: Math.floor(pegar(p, 4, 8) ?? 0),
    faixa_preco: pegar(p, 4, 2),
    telefone: typeof tel === 'string' ? tel : null,
    telefone_internacional: pegar(p, 178, 0, 1, 1, 0),
    site: limparLinkGoogle(pegar(p, 7, 0)),
    endereco: (pegar(p, 2) || []).join(', ') || pegar(p, 39),
    bairro: end?.[0] ?? null,
    rua: end?.[1] ?? null,
    cidade: end?.[3] ?? null,
    cep: end?.[4] ?? null,
    estado: end?.[5] ?? null,
    pais: end?.[6] ?? null,
    latitude: pegar(p, 9, 2),
    longitude: pegar(p, 9, 3),
    fuso_horario: pegar(p, 30),
    situacao: pegar(p, 34, 4, 4),
    fechado_temporariamente: (pegar(p, 160, 0) ?? 0) >= 1,
    fechado_permanentemente: (pegar(p, 23) ?? 0) >= 1,
    horarios,
    fechado_em: horarios.filter((h) => !/\d/.test(h.horarios.join(''))).map((h) => h.dia),
    sobre: extrairSobre(p),
    reservas: (pegar(p, 46) || []).map((r) => ({ link: limparLinkGoogle(r[0]), fonte: r[1] })),
    pedido_online: (pegar(p, 75, 0, 1, 2) || pegar(p, 75, 0, 0, 2) || []).map((r) => ({
      fonte: pegar(r, 0, 0),
      link: limparLinkGoogle(pegar(r, 1, 2, 0)),
    })),
    distribuicao_notas: Array.isArray(distribuicao)
      ? { 1: distribuicao[0] ?? 0, 2: distribuicao[1] ?? 0, 3: distribuicao[2] ?? 0, 4: distribuicao[3] ?? 0, 5: distribuicao[4] ?? 0 }
      : null,
    palavras_chave_avaliacoes: (pegar(p, 153, 0) || []).map((k) => ({ palavra: k[1], qtd: pegar(k, 3, 4) })),
    proprietario: pegar(p, 57, 1) ?? null,
    proprietario_link: dono ? `https://www.google.com/maps/contrib/${dono}` : null,
    pode_reivindicar: podeReivindicar(p),
    link_avaliacoes: limparLinkGoogle(pegar(p, 4, 3, 0)),
    imagem: extrairImagem(p),
  };
}

export function analisarResposta(dados) {
  const lista = pegar(dados, 0, 1);
  if (!Array.isArray(lista)) return [];
  const lugares = [];
  for (const item of lista) {
    const lugar = analisarLugar(pegar(item, 14));
    if (lugar) {
      lugar.link = linkDoLugar(lugar);
      lugares.push(lugar);
    }
  }
  return lugares;
}

export async function buscarPagina(parametros, opcoes) {
  const dados = await obterJsonGoogle(montarUrlBusca(parametros), opcoes);
  return analisarResposta(dados);
}
