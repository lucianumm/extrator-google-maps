#!/usr/bin/env node
// Linha de comando: roda uma extração a partir de um arquivo JSON (o mesmo formato que a
// interface envia para POST /api/tarefas) e grava o resultado. Rode com --ajuda para ver tudo.

import './env.js'; // primeiro: carrega o .env antes dos módulos que leem process.env
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './caminhos.js';
import { explicarErro, ErroValidacao } from './erros.js';
import { normalizar } from './localidades/ibge.js';
import { paises, obterPais } from './localidades/paises.js';

const AJUDA = `
Extrator Google Maps — linha de comando

USO
  node src/cli.js <tarefa.json> [opções]      roda a extração e grava o resultado
  node src/cli.js <tarefa.json> --simular     só confere a configuração e mostra o plano
  node src/cli.js --exemplo [modo]            mostra um arquivo de exemplo pronto para copiar
  node src/cli.js --paises [busca]            lista países e códigos (para o modo "pais")
  node src/cli.js --regioes <país>            lista os estados/províncias de um país

OPÇÕES
  --formato csv|xlsx|json   formato do arquivo gerado (padrão: csv)
  --saida <arquivo>         onde gravar (padrão: <id-da-tarefa>.<formato> na pasta atual)
  --simular                 valida, monta o plano de buscas e mostra quantas buscas e quanto tempo
  --ajuda                   mostra esta ajuda

EXEMPLOS
  node src/cli.js --exemplo brasil-rapida > minha-tarefa.json
  node src/cli.js minha-tarefa.json --simular
  node src/cli.js minha-tarefa.json --formato xlsx --saida dentistas.xlsx

Modos de localidade ("modo_local"): brasil, pais, livre, ponto, poligono, links.
Referência completa de todos os campos: docs/CONFIGURACAO.md
Ctrl+C cancela e grava o que já foi coletado.
`;

const args = process.argv.slice(2);
const COM_VALOR = ['formato', 'saida', 'exemplo', 'paises', 'regioes'];
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  if (i === -1) return padrao;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};
const arquivo = args.find((a, i) => !a.startsWith('--') && !(COM_VALOR.includes(args[i - 1]?.slice(2))));

function falhar(e) {
  const d = explicarErro(e);
  console.error(`\n✖ ${d.titulo}\n  ${d.causa}`);
  for (const f of d.faltou || []) console.error(`  - ${f}`);
  console.error(`  Como resolver: ${d.solucao}`);
  process.exit(1);
}

// ---------- comandos de consulta (não rodam extração) ----------
if (args.includes('--ajuda') || args.includes('-h') || args.includes('--help')) {
  console.log(AJUDA);
  process.exit(0);
}

if (args.includes('--exemplo')) {
  const pasta = path.join(RAIZ, 'exemplos');
  const disponiveis = fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const modo = opcao('exemplo', '');
  if (!modo || !disponiveis.includes(modo)) {
    if (modo) console.error(`Exemplo "${modo}" não existe.\n`);
    console.log('Exemplos disponíveis (node src/cli.js --exemplo <nome> > minha-tarefa.json):\n');
    for (const n of disponiveis) {
      const { nome } = JSON.parse(fs.readFileSync(path.join(pasta, `${n}.json`), 'utf8'));
      console.log(`  ${n.padEnd(18)} ${nome || ''}`);
    }
    process.exit(modo ? 1 : 0);
  }
  process.stdout.write(fs.readFileSync(path.join(pasta, `${modo}.json`), 'utf8'));
  process.exit(0);
}

if (args.includes('--paises')) {
  const q = normalizar(opcao('paises', ''));
  const lista = paises.filter((p) => !q || normalizar(p.nome).includes(q) || p.codigo.toLowerCase() === q);
  console.log('Código  País                                  Idioma   Cidades na base');
  for (const p of lista) console.log(`${p.codigo.padEnd(8)}${p.nome.padEnd(38)}${p.idioma.padEnd(9)}${p.cidades}`);
  console.log(`\nUse no JSON: "modo_local": "pais", "pais": { "codigo": "PT", "max_cidades": 20 }`);
  process.exit(0);
}

if (args.includes('--regioes')) {
  const pais = obterPais(opcao('regioes', ''));
  if (!pais) falhar(new ErroValidacao(`País "${opcao('regioes', '')}" não encontrado.`, { solucao: 'Use o código de 2 letras (PT, US, AR…) ou o nome em português. Veja: node src/cli.js --paises' }));
  console.log(`Regiões de ${pais.nome} (use os nomes em "pais": { "regioes": [...] }):\n`);
  for (const nome of Object.values(pais.regioes).sort((a, b) => a.localeCompare(b))) console.log(`  ${nome}`);
  process.exit(0);
}

if (!arquivo) {
  console.log(AJUDA);
  process.exit(1);
}

const formato = opcao('formato', 'csv');
if (!['csv', 'xlsx', 'json'].includes(formato)) falhar(new ErroValidacao(`Formato "${formato}" inválido.`, { solucao: 'Use --formato csv, --formato xlsx ou --formato json.' }));

let config;
try {
  config = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
} catch (e) {
  falhar(e.code === 'ENOENT'
    ? new ErroValidacao(`Arquivo não encontrado: ${arquivo}`, { solucao: 'Confira o caminho. Para criar um: node src/cli.js --exemplo brasil-rapida > minha-tarefa.json' })
    : new ErroValidacao(`Não consegui ler "${arquivo}": ${e.message}`, { solucao: 'Confira se o arquivo é um JSON válido (aspas duplas, sem vírgula sobrando no fim das listas). Veja exemplos/.' }));
}

// Os módulos abaixo carregam a pasta de tarefas e o cliente do Google; só são importados quando
// realmente vamos simular ou extrair.
const { planejarConsultas, resumirPlano, formatarDuracao } = await import('./tarefas/planejador.js');

// ---------- simulação ----------
if (args.includes('--simular')) {
  try {
    const consultas = await planejarConsultas(config, (m) => console.log(`  ${m}`));
    const r = resumirPlano(consultas);
    console.log(`\n✔ Configuração válida.`);
    console.log(`  Buscas planejadas: ${r.consultas.toLocaleString('pt-BR')}`);
    console.log(`  Requisições ao Google: de ${r.requisicoes_min.toLocaleString('pt-BR')} a ${r.requisicoes_max.toLocaleString('pt-BR')} (depende de quantas páginas cada busca tiver)`);
    console.log(`  Tempo estimado das buscas: ${formatarDuracao(r.tempo_min_s)} a ${formatarDuracao(r.tempo_max_s)} (+ detalhes/contatos, se ativados)`);
    console.log(`  Primeiras buscas:`);
    for (const e of r.exemplos) console.log(`    · ${e}`);
    console.log('\nPara rodar de verdade, tire o --simular.');
    process.exit(0);
  } catch (e) {
    falhar(e);
  }
}

// ---------- extração ----------
const { criarTarefa, obterTarefa, obterResultados, cancelarTarefa, STATUS_ATIVOS } = await import('./tarefas/gerenciador.js');
const { paraCsv, paraXlsx } = await import('./exportar.js');

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

// O log da tarefa guarda só as últimas 400 linhas; `linhas_log` é o total já registrado.
let impressas = 0;
let atual;
do {
  await new Promise((r) => setTimeout(r, 1000));
  atual = obterTarefa(tarefa.id);
  const novas = (atual.linhas_log || atual.log.length) - impressas;
  if (novas > 0) for (const linha of atual.log.slice(-novas)) console.log(linha);
  impressas = atual.linhas_log || atual.log.length;
} while (STATUS_ATIVOS.includes(atual.status));

const resultados = obterResultados(tarefa.id);
const saida = path.resolve(opcao('saida', '') || `${tarefa.id}.${formato}`);
const corpo = formato === 'json' ? JSON.stringify(resultados, null, 2) : formato === 'csv' ? paraCsv(resultados) : Buffer.from(await paraXlsx(resultados));
fs.writeFileSync(saida, corpo);
console.log(`${resultados.length} empresa(s) gravadas em ${saida} (status: ${atual.status})`);
if (atual.status === 'erro' && atual.erro_detalhe) console.error(`\n✖ ${atual.erro_detalhe.titulo}\n  Como resolver: ${atual.erro_detalhe.solucao}`);
process.exit(atual.status === 'concluida' || atual.status === 'cancelada' ? 0 : 1);
