// Carrega o arquivo .env da raiz do projeto (se existir) antes dos outros módulos lerem
// process.env. Copie .env.exemplo para .env e ajuste. Variáveis já definidas no sistema têm
// prioridade sobre o arquivo.

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './caminhos.js';

const arquivo = path.join(RAIZ, '.env');
if (fs.existsSync(arquivo)) {
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
