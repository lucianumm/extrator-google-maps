// Roda todos os testes de test/*.test.js com o runner nativo do Node.
// O "node --test" aceita glob só a partir do Node 21 e, no Node 24, não aceita pasta;
// listar os arquivos explicitamente funciona igual em todas as versões suportadas (>= 20).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test');
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(pasta, f));

const r = spawnSync(process.execPath, ['--test', ...arquivos], { stdio: 'inherit' });
process.exit(r.status ?? 1);
