// Servidor local: API + interface web em português.

import './env.js'; // primeiro: carrega o .env antes dos módulos que leem process.env
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import { RAIZ } from './caminhos.js';
import { protegerLocal } from './seguranca.js';
import { explicarErro } from './erros.js';
import { estados, buscarMunicipios, municipiosDosEstados, regioesDoEstado, malhaMunicipio, obterMunicipio } from './localidades/ibge.js';
import { paises, obterPais, cidadesDoPais } from './localidades/paises.js';
import { sugerirLocalidades } from './maps/sugestoes.js';
import { planejarConsultas, resumirPlano, avisosDaConfig } from './tarefas/planejador.js';
import { criarTarefa, listarTarefas, obterTarefa, obterResultados, cancelarTarefa, excluirTarefa, eventos } from './tarefas/gerenciador.js';
import { paraCsv, paraXlsx, COLUNAS } from './exportar.js';
import { diagnosticar } from './maps/diagnostico.js';
import { estadoSessao, renovarSessao, limparSessao, configurarSessao } from './maps/sessao.js';

const PORTA = Number(process.env.PORTA) || 3210;
const categorias = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'categorias.json'), 'utf8'));
// Pedido de apoio (Pix) mostrado ao abrir e ao concluir uma extração; "ativo": false desliga.
const apoio = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'apoio.json'), 'utf8'));

const app = express();
app.disable('x-powered-by');
app.use(protegerLocal(PORTA));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(RAIZ, 'publico')));

// Toda falha vira { erro, detalhe: { titulo, causa, solucao, tecnico, faltou? } }: `erro` é o texto
// curto e `detalhe` alimenta a janela de erro da interface.
function responderErro(res, e) {
  const detalhe = explicarErro(e);
  console.error(`[erro] ${detalhe.tecnico}`);
  res.status(e.name === 'ErroValidacao' ? 400 : e.status || 500).json({ erro: e.name === 'ErroValidacao' ? e.message : `${detalhe.titulo}: ${detalhe.causa}`, detalhe });
}

const rota = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    responderErro(res, e);
  }
};

app.get('/api/apoio', (_, res) => res.json(apoio));
app.get('/api/categorias', (_, res) => res.json(categorias));
app.get('/api/estados', (_, res) => res.json(estados));
app.get('/api/estados/:uf/regioes', (req, res) => res.json(regioesDoEstado(req.params.uf.toUpperCase())));
app.get('/api/estados/:uf/municipios', (req, res) =>
  res.json(municipiosDosEstados([req.params.uf.toUpperCase()]).map(({ id, nome, uf, meso }) => ({ id, nome, uf, meso }))));
app.get('/api/municipios', (req, res) => {
  const ufs = String(req.query.ufs || '').split(',').filter(Boolean);
  res.json(buscarMunicipios(req.query.q || '', { ufs, limite: Number(req.query.limite) || 30 }));
});
app.get('/api/municipios/:id/malha', rota(async (req, res) => {
  if (!obterMunicipio(req.params.id)) return res.status(404).json({ erro: 'Município não encontrado' });
  res.json(await malhaMunicipio(req.params.id));
}));
app.get('/api/paises', (_, res) => res.json(paises.map(({ codigo, nome, idioma, continente, cidades, regioes }) => ({
  codigo, nome, idioma, continente, cidades, regioes: Object.values(regioes).sort((a, b) => a.localeCompare(b)),
}))));
app.get('/api/paises/:codigo/cidades', (req, res) => {
  if (!obterPais(req.params.codigo)) return res.status(404).json({ erro: 'País não encontrado' });
  const regioes = String(req.query.regioes || '').split('|').filter(Boolean);
  res.json(cidadesDoPais(req.params.codigo, {
    regioes, maximo: req.query.maximo === undefined ? 20 : Number(req.query.maximo) || 0, populacaoMinima: Number(req.query.populacao_minima) || 0,
  }));
});
app.get('/api/sugestoes', rota(async (req, res) => {
  const q = String(req.query.q || '').trim();
  res.json(q.length < 2 ? [] : await sugerirLocalidades(q, { idioma: req.query.hl || 'pt-BR', regiao: req.query.gl || 'br' }));
}));

app.get('/api/diagnostico', rota(async (req, res) => res.json(await diagnosticar({ idioma: req.query.hl || 'pt-BR', regiao: req.query.gl ?? 'br' }))));
app.get('/api/sessao', (_, res) => res.json(estadoSessao()));
app.post('/api/sessao', rota(async (req, res) => {
  const { acao, usarNavegador } = req.body || {};
  if (typeof usarNavegador === 'boolean') configurarSessao({ usarNavegador });
  if (acao === 'limpar') limparSessao();
  if (acao === 'login' || acao === 'verificar') {
    // não espera: o navegador fica aberto até o usuário terminar
    // (a falha fica em estadoSessao().ultimoErro e a interface a mostra)
    renovarSessao({ modo: acao, aoLog: (m) => console.log(m) }).catch((e) => console.error('Sessão:', e.message));
  }
  res.json(estadoSessao());
}));

app.get('/api/tarefas', (_, res) => res.json(listarTarefas()));
app.post('/api/tarefas', rota(async (req, res) => res.json(criarTarefa(req.body || {}))));
// Monta o plano sem executar: quantas buscas, tempo estimado e as primeiras consultas.
app.post('/api/simular', rota(async (req, res) => {
  const cfg = req.body || {};
  const log = [];
  const consultas = await planejarConsultas(cfg, (m) => log.push(m));
  res.json({ ...resumirPlano(consultas), avisos: avisosDaConfig(cfg), log: log.slice(-20) });
}));
app.get('/api/tarefas/:id', (req, res) => {
  const t = obterTarefa(req.params.id);
  t ? res.json(t) : res.status(404).json({ erro: 'Tarefa não encontrada' });
});
app.get('/api/tarefas/:id/resultados', (req, res) => {
  const r = obterResultados(req.params.id);
  r ? res.json(r) : res.status(404).json({ erro: 'Tarefa não encontrada' });
});
app.post('/api/tarefas/:id/cancelar', (req, res) => res.json({ ok: cancelarTarefa(req.params.id) }));
app.delete('/api/tarefas/:id', (req, res) => res.json({ ok: excluirTarefa(req.params.id) }));
app.get('/api/colunas', (_, res) => res.json(COLUNAS.map(([t]) => t)));

app.get('/api/tarefas/:id/exportar/:formato', rota(async (req, res) => {
  const t = obterTarefa(req.params.id);
  let dados = obterResultados(req.params.id);
  if (!t || !dados) return res.status(404).json({ erro: 'Tarefa não encontrada' });
  if (req.query.ids) {
    const ids = new Set(String(req.query.ids).split(','));
    dados = dados.filter((l) => ids.has(l.place_id || l.data_id));
  }
  const base = t.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60) || 'extracao';
  const fmt = req.params.formato;
  const enviar = (tipo, ext, corpo) => {
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${base}.${ext}"`);
    res.send(corpo);
  };
  if (fmt === 'csv') return enviar('text/csv; charset=utf-8', 'csv', paraCsv(dados));
  if (fmt === 'json') return enviar('application/json; charset=utf-8', 'json', JSON.stringify(dados, null, 2));
  if (fmt === 'xlsx') return enviar('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', Buffer.from(await paraXlsx(dados)));
  res.status(400).json({ erro: 'Formato inválido (use csv, xlsx ou json)' });
}));

// Atualizações em tempo real (Server-Sent Events).
app.get('/api/eventos', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const enviar = (tipo) => (dados) => res.write(`event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`);
  const aoTarefa = enviar('tarefa');
  const aoRemover = enviar('removida');
  eventos.on('tarefa', aoTarefa);
  eventos.on('removida', aoRemover);
  const pulso = setInterval(() => res.write(': pulso\n\n'), 25000);
  req.on('close', () => {
    clearInterval(pulso);
    eventos.off('tarefa', aoTarefa);
    eventos.off('removida', aoRemover);
  });
});

// Rotas /api inexistentes e erros de corpo (JSON inválido, corpo grande demais) também respondem em JSON.
app.use('/api', (req, res) => res.status(404).json({
  erro: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  detalhe: { titulo: 'Rota não encontrada', causa: `${req.method} ${req.originalUrl} não existe neste programa.`, solucao: 'Recarregue a página (F5). Se a interface continuar chamando essa rota, o programa e a interface estão em versões diferentes.' },
}));
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  const corpoInvalido = e.type === 'entity.parse.failed' || e.type === 'entity.too.large';
  const detalhe = corpoInvalido
    ? {
        titulo: e.type === 'entity.too.large' ? 'Dados grandes demais' : 'Dados enviados inválidos',
        causa: e.type === 'entity.too.large' ? 'O pedido ultrapassa o limite de 20 MB (um GeoJSON ou uma lista colada muito grande?).' : 'O pedido não é um JSON válido.',
        solucao: e.type === 'entity.too.large' ? 'Reduza o tamanho da lista ou do polígono e tente de novo.' : 'Recarregue a página (F5) e tente de novo.',
        tecnico: `${e.type}: ${e.message}`,
      }
    : explicarErro(e);
  res.status(e.status || 500).json({ erro: `${detalhe.titulo}: ${detalhe.causa}`, detalhe });
});

app.listen(PORTA, '127.0.0.1', () => {
  const url = `http://localhost:${PORTA}`;
  console.log(`Extrator rodando em ${url}`);
  if (process.env.ABRIR_NAVEGADOR) {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});
