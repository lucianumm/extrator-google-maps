// Autoteste dos endpoints do Google: confirma que busca, detalhes, avaliações, fotos e
// sugestões ainda respondem no formato esperado. Também calcula o preenchimento dos campos
// de uma lista de resultados para alertar quando o Google mudar a estrutura das respostas.

import { buscarPagina } from './busca.js';
import { buscarDetalhes } from './lugar.js';
import { buscarAvaliacoes } from './avaliacoes.js';
import { buscarFotos } from './fotos.js';
import { sugerirLocalidades } from './sugestoes.js';

const CAMPOS_ESSENCIAIS = ['place_id', 'data_id', 'endereco', 'latitude', 'categoria_principal'];

export function saudeDosCampos(lugares) {
  const total = lugares.length || 1;
  const taxa = {};
  for (const c of [...CAMPOS_ESSENCIAIS, 'telefone', 'site', 'nota']) {
    taxa[c] = Math.round((100 * lugares.filter((l) => l[c] != null && l[c] !== '').length) / total);
  }
  const quebrados = CAMPOS_ESSENCIAIS.filter((c) => taxa[c] < 20);
  return { taxa, quebrados, suspeito: lugares.length >= 10 && quebrados.length > 0 };
}

async function etapa(nome, fn) {
  const inicio = Date.now();
  try {
    const detalhe = await fn();
    return { nome, ok: true, ms: Date.now() - inicio, detalhe };
  } catch (e) {
    return { nome, ok: false, ms: Date.now() - inicio, detalhe: e.message };
  }
}

export async function diagnosticar({ consulta = 'pizzaria em São Paulo - SP', idioma = 'pt-BR', regiao = 'br' } = {}) {
  const r = [];
  let lugares = [];
  r.push(await etapa('Busca de lugares', async () => {
    lugares = await buscarPagina({ consulta, idioma, regiao });
    if (!lugares.length) throw new Error('nenhum lugar retornado — formato pode ter mudado');
    const s = saudeDosCampos(lugares);
    if (s.quebrados.length) throw new Error(`campos vazios: ${s.quebrados.join(', ')} (${JSON.stringify(s.taxa)})`);
    return `${lugares.length} lugares; preenchimento ${JSON.stringify(s.taxa)}`;
  }));
  const alvo = lugares.find((l) => l.avaliacoes > 50) || lugares[0];
  let det = null;
  r.push(await etapa('Detalhes do lugar', async () => {
    if (!alvo) throw new Error('sem lugar para testar');
    det = await buscarDetalhes(alvo, { idioma, regiao });
    if (!det) throw new Error('página do lugar não trouxe dados');
    return `${det.nome}: distribuição de notas ${det.distribuicao_notas ? 'ok' : 'vazia'}, capa ${det.imagem ? 'ok' : 'vazia'}, ${det.fotosPrevia.length} fotos na prévia`;
  }));
  r.push(await etapa('Avaliações', async () => {
    const a = await buscarAvaliacoes(alvo?.data_id, { maximo: 5, idioma, regiao });
    if (!a.length) throw new Error('nenhuma avaliação retornada');
    return `${a.length} avaliações; texto ${a.some((x) => x.texto) ? 'ok' : 'vazio'}`;
  }));
  r.push(await etapa('Fotos', async () => {
    const f = await buscarFotos(alvo, { maximo: 60, idioma, regiao, iniciais: det?.fotosPrevia || [] });
    if (!f.length) throw new Error('nenhuma foto retornada');
    return `${f.length} fotos`;
  }));
  r.push(await etapa('Sugestões de localidade', async () => {
    const s = await sugerirLocalidades('Campinas', { idioma, regiao });
    if (!s.length) throw new Error('nenhuma sugestão');
    return `${s.length} sugestões (${s[0].descricao})`;
  }));
  return { ok: r.every((x) => x.ok), etapas: r, em: new Date().toISOString() };
}
