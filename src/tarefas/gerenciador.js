// Execução e persistência das tarefas de extração.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PASTA_SAIDA } from '../caminhos.js';
import { escreverAtomico } from '../arquivo.js';
import { buscarPagina, TAMANHO_PAGINA } from '../maps/busca.js';
import { buscarAvaliacoes } from '../maps/avaliacoes.js';
import { ErroCancelado, ErroBloqueio } from '../maps/cliente.js';
import { buscarDetalhes, mesclarDetalhes } from '../maps/lugar.js';
import { buscarFotos, baixarFotos } from '../maps/fotos.js';
import { saudeDosCampos } from '../maps/diagnostico.js';
import { coletarContatos } from '../contatos/site.js';
import { verificarEmail, recomendarEmails } from '../contatos/verificar.js';
import { buscarLeads } from '../contatos/apollo.js';
import { normalizar } from '../localidades/ibge.js';
import { planejarConsultas, validarConfig, regiaoPadrao } from './planejador.js';
import { dentroDaArea } from './area.js';
import { explicarErro } from '../erros.js';

const PASTA_TAREFAS = path.join(PASTA_SAIDA, 'tarefas');
fs.mkdirSync(PASTA_TAREFAS, { recursive: true });

export const eventos = new EventEmitter();
eventos.setMaxListeners(100);

const tarefas = new Map(); // id -> { meta, resultados, controle }
export const STATUS_ATIVOS = ['na_fila', 'planejando', 'executando', 'detalhes', 'fotos', 'avaliacoes', 'contatos', 'verificando', 'leads'];

function pastaDa(id) {
  return path.join(PASTA_TAREFAS, id);
}

function salvar(t, comResultados = false) {
  const pasta = pastaDa(t.meta.id);
  fs.mkdirSync(pasta, { recursive: true });
  escreverAtomico(path.join(pasta, 'tarefa.json'), JSON.stringify(t.meta, null, 2));
  if (comResultados) escreverAtomico(path.join(pasta, 'resultados.json'), JSON.stringify(t.resultados));
}

function avisar(t, forcar = false) {
  const agora = Date.now();
  if (!forcar && agora - (t.ultimoAviso || 0) < 400) return;
  t.ultimoAviso = agora;
  eventos.emit('tarefa', resumo(t));
}

function registrar(t, msg) {
  const linha = `${new Date().toLocaleTimeString('pt-BR')}  ${msg}`;
  t.meta.log.push(linha);
  t.meta.linhas_log = (t.meta.linhas_log || 0) + 1; // total já registrado (o log guarda só as últimas 400)
  if (t.meta.log.length > 400) t.meta.log.splice(0, t.meta.log.length - 400);
  avisar(t);
}

export function resumo(t) {
  const { log, config, ...resto } = t.meta;
  return { ...resto, nome: t.meta.nome, log: log.slice(-60), config };
}

// Carrega tarefas salvas em execuções anteriores.
for (const id of fs.readdirSync(PASTA_TAREFAS)) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(pastaDa(id), 'tarefa.json'), 'utf8'));
    if (STATUS_ATIVOS.includes(meta.status)) {
      meta.status = 'interrompida';
      meta.erro_detalhe = {
        titulo: 'Extração interrompida',
        causa: 'O programa foi fechado (ou caiu) enquanto esta extração ainda rodava.',
        solucao: 'Os resultados coletados até ali foram mantidos e podem ser exportados. Para completar, inicie uma nova extração com as mesmas opções.',
      };
    }
    tarefas.set(id, { meta, resultados: null });
  } catch { /* pasta inválida */ }
}

function carregarResultados(t) {
  if (t.resultados) return t.resultados;
  const arq = path.join(pastaDa(t.meta.id), 'resultados.json');
  t.resultados = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : [];
  return t.resultados;
}

export function listarTarefas() {
  return [...tarefas.values()].map(resumo).sort((a, b) => b.criada_em.localeCompare(a.criada_em));
}

export function obterTarefa(id) {
  const t = tarefas.get(id);
  return t ? { ...resumo(t), log: t.meta.log } : null;
}

export function obterResultados(id) {
  const t = tarefas.get(id);
  return t ? carregarResultados(t) : null;
}

export function cancelarTarefa(id) {
  const t = tarefas.get(id);
  if (!t?.controle) return false;
  t.cancelada = true;
  t.controle.abort();
  return true;
}

export function excluirTarefa(id) {
  const t = tarefas.get(id);
  if (!t) return false;
  t.cancelada = true;
  t.controle?.abort();
  tarefas.delete(id);
  fs.rmSync(pastaDa(id), { recursive: true, force: true });
  eventos.emit('removida', { id });
  return true;
}

function passaNosFiltros(l, f = {}) {
  if (f.excluir_fechados && (l.fechado_permanentemente || l.fechado_temporariamente)) return 'fechado';
  if (f.min_avaliacoes != null && f.min_avaliacoes !== '' && l.avaliacoes < Number(f.min_avaliacoes)) return 'poucas avaliações';
  if (f.max_avaliacoes != null && f.max_avaliacoes !== '' && l.avaliacoes > Number(f.max_avaliacoes)) return 'muitas avaliações';
  if (f.nota_minima != null && f.nota_minima !== '' && (l.nota ?? 0) < Number(f.nota_minima)) return 'nota baixa';
  if (f.nota_maxima != null && f.nota_maxima !== '' && l.nota != null && l.nota > Number(f.nota_maxima)) return 'nota alta';
  if (f.site === 'com' && !l.site) return 'sem site';
  if (f.site === 'sem' && l.site) return 'com site';
  if (f.telefone === 'com' && !l.telefone) return 'sem telefone';
  if (f.telefone === 'sem' && l.telefone) return 'com telefone';
  const cats = normalizar(l.categorias.join(' | '));
  const contem = String(f.categoria_contem || '').split(',').map(normalizar).filter(Boolean);
  if (contem.length && !contem.some((c) => cats.includes(c))) return 'categoria diferente';
  const exclui = String(f.categoria_exclui || '').split(',').map(normalizar).filter(Boolean);
  if (exclui.some((c) => cats.includes(c))) return 'categoria excluída';
  return null;
}

// Roda `fn` sobre os itens com `limite` trabalhadores. Se um deles falhar (ex.: bloqueio do
// Google), aborta o controle da tarefa para os demais pararem, espera todos terminarem e
// relança o primeiro erro.
export async function emParalelo(itens, limite, fn, controle) {
  const sinal = controle.signal;
  let i = 0;
  let primeiroErro = null;
  const trabalhadores = Array.from({ length: Math.max(1, limite) }, async () => {
    try {
      while (i < itens.length) {
        if (sinal.aborted) throw new ErroCancelado();
        const idx = i++;
        await fn(itens[idx], idx);
      }
    } catch (e) {
      primeiroErro ??= e;
      controle.abort();
    }
  });
  await Promise.all(trabalhadores);
  if (primeiroErro) throw primeiroErro;
}

async function executar(t) {
  const { meta } = t;
  const cfg = meta.config;
  const sinal = t.controle.signal;
  const idioma = cfg.idioma && cfg.idioma !== 'auto' ? cfg.idioma : 'pt-BR';
  const regiao = cfg.regiao ?? regiaoPadrao(cfg);
  const vistos = new Set();
  const maxPorConsulta = Number(cfg.max_resultados_por_consulta) || null;
  const maxTotal = Number(cfg.max_resultados_total) || null;
  let ultimoSalvamento = Date.now();

  try {
    meta.status = 'planejando';
    registrar(t, 'Planejando consultas…');
    const consultas = await planejarConsultas(cfg, (m) => registrar(t, m));
    meta.progresso.consultas_total = consultas.length;
    meta.status = 'executando';
    registrar(t, `${consultas.length} consulta(s) planejada(s)`);

    await emParalelo(consultas, Number(cfg.paralelismo) || 2, async (c) => {
      let novosNaConsulta = 0, paginasSemNovos = 0;
      for (let pag = 0; pag < c.maxPaginas; pag++) {
        if (sinal.aborted) throw new ErroCancelado();
        if (maxTotal && t.resultados.length >= maxTotal) break;
        let lugares;
        try {
          lugares = await buscarPagina(
            { consulta: c.consulta, lat: c.lat, lon: c.lon, zoom: c.zoom, deslocamento: pag * TAMANHO_PAGINA, idioma: c.idioma ?? idioma, regiao: c.regiao ?? regiao },
            { sinal, aoLog: (m) => registrar(t, m) },
          );
        } catch (e) {
          if (e instanceof ErroCancelado || e instanceof ErroBloqueio) throw e;
          meta.progresso.erros++;
          registrar(t, `Erro em "${c.rotulo}" (página ${pag + 1}): ${e.message}`);
          break;
        }
        meta.progresso.paginas++;
        if (c.unico) lugares = lugares.slice(0, 1);
        let novos = 0;
        for (const l of lugares) {
          const chave = l.place_id || l.data_id || l.kgmid || `${l.nome}|${l.endereco}`;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          meta.progresso.encontrados++;
          if (!dentroDaArea(l, c.filtro)) { meta.progresso.fora_da_area++; continue; }
          const motivo = passaNosFiltros(l, cfg.filtros);
          if (motivo) { meta.progresso.filtrados++; continue; }
          l.consulta = c.rotulo;
          l.tipo_buscado = c.tipo;
          t.resultados.push(l);
          novos++;
          novosNaConsulta++;
          if (maxPorConsulta && novosNaConsulta >= maxPorConsulta) break;
          if (maxTotal && t.resultados.length >= maxTotal) break;
        }
        meta.progresso.resultados = t.resultados.length;
        paginasSemNovos = novos === 0 ? paginasSemNovos + 1 : 0;
        // o arquivo inteiro é regravado; espaça mais as gravações quando a lista cresce
        if (Date.now() - ultimoSalvamento > Math.max(5000, t.resultados.length * 3)) { salvar(t, true); ultimoSalvamento = Date.now(); }
        avisar(t);
        if (lugares.length < TAMANHO_PAGINA || paginasSemNovos >= 2) break;
        if (maxPorConsulta && novosNaConsulta >= maxPorConsulta) break;
      }
      meta.progresso.consultas_feitas++;
      registrar(t, `✓ ${c.rotulo}: ${novosNaConsulta} novo(s) — total ${t.resultados.length}`);
    }, t.controle);

    salvar(t, true);

    const saude = saudeDosCampos(t.resultados);
    meta.saude = saude;
    if (saude.suspeito) {
      registrar(t, `⚠ Campos essenciais vazios (${saude.quebrados.join(', ')}). O Google pode ter mudado o formato — rode o Diagnóstico em Avançado.`);
    }

    // Executa uma fase de enriquecimento sobre uma lista, com progresso e paralelismo.
    const fase = async (status, mensagem, lista, paralelo, fn) => {
      if (!lista.length) return;
      meta.status = status;
      registrar(t, mensagem.replace('{n}', lista.length));
      meta.progresso.enriquecimento_total = lista.length;
      meta.progresso.enriquecimento_feito = 0;
      await emParalelo(lista, paralelo, async (l) => {
        try {
          await fn(l);
        } catch (e) {
          if (e instanceof ErroCancelado || e instanceof ErroBloqueio) throw e;
          meta.progresso.erros++;
          registrar(t, `${l.nome}: ${e.message}`);
        }
        meta.progresso.enriquecimento_feito++;
        avisar(t);
      }, t.controle);
      salvar(t, true);
    };
    const opc = { idioma, regiao, sinal, aoLog: (m) => registrar(t, m) };
    const previas = new Map();

    if (cfg.detalhes?.ativo !== false) {
      await fase('detalhes', 'Buscando detalhes completos de {n} lugar(es)…', t.resultados, 3, async (l) => {
        const det = await buscarDetalhes(l, opc);
        if (!det) throw new Error('detalhes indisponíveis');
        previas.set(l, det.fotosPrevia);
        mesclarDetalhes(l, det);
      });
    }

    if (cfg.fotos?.ativo) {
      const pastaFotos = path.join(pastaDa(meta.id), 'fotos');
      await fase('fotos', 'Coletando fotos de {n} lugar(es)…', t.resultados, 3, async (l) => {
        l.fotos = await buscarFotos(l, {
          ...opc, maximo: Number(cfg.fotos.maximo) || 0, incluirStreetView: !!cfg.fotos.street_view, iniciais: previas.get(l) || [],
        });
        if (cfg.fotos.baixar && l.fotos.length) await baixarFotos(l, pastaFotos, { sinal });
      });
      if (cfg.fotos.baixar) registrar(t, `Fotos salvas em ${pastaFotos}`);
    }

    if (cfg.avaliacoes?.ativo) {
      await fase('avaliacoes', 'Extraindo avaliações de {n} lugar(es)…', t.resultados, 2, async (l) => {
        l.lista_avaliacoes = [];
        l.lista_avaliacoes = await buscarAvaliacoes(l.data_id, {
          ...opc, maximo: Number(cfg.avaliacoes.maximo) || 0, ordenacao: cfg.avaliacoes.ordenacao, desde: cfg.avaliacoes.desde || null,
        });
      });
    }

    const comSite = t.resultados.filter((l) => l.site);
    const ct = { ...(cfg.contatos || {}), chave: t.segredos?.verificacao };
    if (ct.ativo) {
      await fase('contatos', 'Procurando e-mails e redes sociais em {n} site(s)…', comSite, 6, async (l) => {
        Object.assign(l, await coletarContatos(l.site, { paginasExtras: ct.paginas_extras ?? 3 }));
        const qtd = Number(ct.recomendados) || 1;
        l.emails_recomendados = recomendarEmails(l.emails || [], l.site, qtd);
      });
      if (ct.verificar) {
        const comEmail = comSite.filter((l) => (l.emails_recomendados?.length || l.emails?.length));
        await fase('verificando', 'Verificando e-mails de {n} empresa(s)…', comEmail, 4, async (l) => {
          const alvo = ct.verificar_todos ? l.emails : l.emails_recomendados;
          l.verificacao_emails = [];
          for (const e of alvo || []) l.verificacao_emails.push(await verificarEmail(e, { servico: ct.servico || 'gratis', chave: ct.chave }));
          l.emails_validos = l.verificacao_emails.filter((v) => v.status === 'valido').map((v) => v.email);
        });
      }
    }

    const ld = { ...(cfg.leads || {}), chave: t.segredos?.apollo };
    if (ld.ativo) {
      if (!ld.chave) registrar(t, 'Leads do Apollo ignorados: informe a chave de API do Apollo.');
      else await fase('leads', 'Buscando decisores no Apollo para {n} empresa(s)…', comSite, 2, async (l) => {
        Object.assign(l, await buscarLeads(l.site, ld));
      });
    }

    meta.status = 'concluida';
    registrar(t, `Concluída: ${t.resultados.length} empresa(s)`);
  } catch (e) {
    if (t.cancelada && !(e instanceof ErroBloqueio)) {
      meta.status = 'cancelada';
      registrar(t, `Cancelada pelo usuário — ${t.resultados.length} resultado(s) mantidos`);
    } else {
      const d = explicarErro(e);
      meta.status = 'erro';
      meta.erro = `${d.titulo}: ${d.causa}`;
      meta.erro_detalhe = d;
      registrar(t, `✖ ${meta.erro}`);
      registrar(t, `   Como resolver: ${d.solucao}`);
      if (t.resultados.length) registrar(t, `   ${t.resultados.length} resultado(s) já coletados foram mantidos e podem ser exportados.`);
    }
  } finally {
    meta.finalizada_em = new Date().toISOString();
    t.controle = null;
    salvar(t, true);
    avisar(t, true);
  }
}

export function criarTarefa(config) {
  validarConfig(config); // lança ErroValidacao listando o que falta, antes de criar qualquer coisa
  // chaves de API ficam só em memória; o tarefa.json guarda apenas um marcador
  const segredos = { verificacao: config.contatos?.chave || '', apollo: config.leads?.chave || '' };
  if (config.contatos) config.contatos = { ...config.contatos, chave: segredos.verificacao ? '••••' : '' };
  if (config.leads) config.leads = { ...config.leads, chave: segredos.apollo ? '••••' : '' };
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex');
  const nomePadrao = [
    (config.tipos || []).slice(0, 3).join(', ') + ((config.tipos || []).length > 3 ? '…' : ''),
    config.rotulo_local,
  ].filter(Boolean).join(' — ');
  const t = {
    meta: {
      id,
      nome: config.nome?.trim() || nomePadrao || 'Extração',
      status: 'na_fila',
      criada_em: new Date().toISOString(),
      finalizada_em: null,
      erro: null,
      config,
      progresso: { consultas_total: 0, consultas_feitas: 0, paginas: 0, encontrados: 0, resultados: 0, filtrados: 0, fora_da_area: 0, erros: 0 },
      log: [],
    },
    resultados: [],
    controle: new AbortController(),
    segredos,
  };
  tarefas.set(id, t);
  salvar(t, true);
  avisar(t, true);
  executar(t);
  return resumo(t);
}
