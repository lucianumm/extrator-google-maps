#!/usr/bin/env node
// Linha de comando: roda uma extração a partir de um arquivo JSON (o mesmo formato que a
// interface envia para POST /api/tarefas) e grava o resultado.
//
//   node src/cli.js exemplos/tarefa.json [--formato csv|xlsx|json] [--saida arquivo]

import fs from 'node:fs';
import path from 'node:path';
import { criarTarefa, obterTarefa, obterResultados, cancelarTarefa, STATUS_ATIVOS } from './tarefas/gerenciador.js';
import { paraCsv, paraXlsx } from './exportar.js';
import { explicarErro, ErroValidacao } from './erros.js';

const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i === -1 ? padrao : args[i + 1];
};
const arquivo = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

if (!arquivo || args.includes('--ajuda')) {
  console.log('Uso: node src/cli.js <tarefa.json> [--formato csv|xlsx|json] [--saida arquivo]');
  process.exit(arquivo ? 0 : 1);
}

const formato = opcao('formato', 'csv');
if (!['csv', 'xlsx', 'json'].includes(formato)) {
  console.error('Formato inválido (use csv, xlsx ou json)');
  process.exit(1);
}

function falhar(e) {
  const d = explicarErro(e);
  console.error(`\n✖ ${d.titulo}\n  ${d.causa}`);
  for (const f of d.faltou || []) console.error(`  - ${f}`);
  console.error(`  Como resolver: ${d.solucao}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
} catch (e) {
  falhar(e.code === 'ENOENT' ? new Error(`Arquivo não encontrado: ${arquivo}`) : new ErroValidacao(`Não consegui ler "${arquivo}": ${e.message}`, { solucao: 'Confira se o arquivo existe e é um JSON válido (veja exemplos/tarefa.json).' }));
}
let tarefa;
try {
  tarefa = criarTarefa(config);
} catch (e) {
  falhar(e);
}
process.on('SIGINT', () => {
  console.log('\nCancelando… (os resultados já coletados serão gravados)');
  cancelarTarefa(tarefa.id);
});

let impressas = 0;
let atual;
do {
  await new Promise((r) => setTimeout(r, 1000));
  atual = obterTarefa(tarefa.id);
  for (const linha of atual.log.slice(impressas)) console.log(linha);
  impressas = atual.log.length;
} while (STATUS_ATIVOS.includes(atual.status));

const resultados = obterResultados(tarefa.id);
const saida = path.resolve(opcao('saida', `${tarefa.id}.${formato}`));
const corpo = formato === 'json' ? JSON.stringify(resultados, null, 2) : formato === 'csv' ? paraCsv(resultados) : Buffer.from(await paraXlsx(resultados));
fs.writeFileSync(saida, corpo);
console.log(`${resultados.length} empresa(s) gravadas em ${saida} (status: ${atual.status})`);
if (atual.status === 'erro' && atual.erro_detalhe) console.error(`\n✖ ${atual.erro_detalhe.titulo}\n  Como resolver: ${atual.erro_detalhe.solucao}`);
process.exit(atual.status === 'concluida' || atual.status === 'cancelada' ? 0 : 1);
