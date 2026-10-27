// Avaliações via PrivateLocalSearchUiDataService/GetLocalBoqProxy.
// Estrutura do "reqpld" e índices dos campos observados nas respostas; o diagnóstico detecta mudanças.

import { obterTexto } from './cliente.js';
import { pegar } from './busca.js';

export const ORDENACOES = { mais_relevantes: 1, mais_recentes: 2, maior_nota: 3, menor_nota: 4 };

function montarUrl(dataId, ordenacao, tamanho, token, idioma, regiao) {
  const corpo = [null, ORDENACOES[ordenacao] ?? 2, null, null, null, null, null, null, null, tamanho, null, [dataId], null, null, '', null,
    [1, 1, null, [[3], [4], [5], [6], [7]]], null, null, token, null, null, null, 0];
  const reqpld = JSON.stringify([null, [null, null, null, null, null, null, null, null, null, corpo]]);
  return 'https://www.google.com/httpservice/web/PrivateLocalSearchUiDataService/GetLocalBoqProxy?sourceid=chrome' +
    `&hl=${encodeURIComponent(idioma)}&gl=${encodeURIComponent(regiao)}&reqpld=${encodeURIComponent(reqpld)}&msc=gwsrpc&opi=89978449`;
}

function dataIso(ms) {
  const n = parseInt(ms, 10);
  return Number.isFinite(n) ? new Date(n).toISOString().replace(/\.\d{3}Z$/, '') : null;
}

function analisarAvaliacao(e) {
  const perfil = pegar(e, 3, 2);
  return {
    id: pegar(e, 5),
    autor: pegar(e, 3, 0),
    autor_perfil: perfil,
    autor_id: perfil?.match(/contrib\/(\d+)/)?.[1] ?? null,
    autor_total_avaliacoes: pegar(e, 3, 3) ?? 0,
    autor_total_fotos: pegar(e, 3, 4) ?? 0,
    guia_local: pegar(e, 3, 5, 1) === 1,
    nota: pegar(e, 1),
    texto: pegar(e, 27) || null,
    texto_traduzido: pegar(e, 37) || null,
    idioma_original: pegar(e, 26) || null,
    publicada: pegar(e, 2, 0),
    publicada_em: dataIso(pegar(e, 2, 2)),
    resposta_proprietario: pegar(e, 4, 2) || null,
    resposta_proprietario_quando: pegar(e, 4, 1) || null,
    link: pegar(e, 12),
    fotos: (pegar(e, 14) || []).map((f) => pegar(f, 0)).filter(Boolean),
  };
}

export async function buscarAvaliacoes(dataId, { maximo = 20, ordenacao = 'mais_recentes', desde = null, idioma = 'pt-BR', regiao = 'br', sinal, aoLog } = {}) {
  if (!dataId) return [];
  const limiteData = desde ? Date.parse(desde) : NaN;
  const saida = [];
  let token = null;
  do {
    const tamanho = maximo ? Math.min(20, maximo - saida.length) : 20;
    const texto = await obterTexto(montarUrl(dataId, ordenacao, tamanho, token, idioma, regiao), { sinal, aoLog, tentativas: 2 });
    const dados = JSON.parse(texto.split(")]}'")[1]);
    const bloco = pegar(dados, 1, 10);
    if (!bloco) break;
    let parar = false;
    for (const bruto of bloco[2] || []) {
      const av = analisarAvaliacao(bruto);
      if (Number.isFinite(limiteData) && av.publicada_em && Date.parse(av.publicada_em + 'Z') < limiteData) {
        if (ordenacao === 'mais_recentes') { parar = true; break; }
        continue;
      }
      saida.push(av);
      if (maximo && saida.length >= maximo) { parar = true; break; }
    }
    token = parar ? null : bloco[6] || null;
  } while (token);
  return saida;
}
