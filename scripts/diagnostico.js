// Roda o diagnóstico dos endpoints do Google no terminal (e no CI agendado).
// Sai com código 1 se alguma etapa falhar — sinal de que o Google mudou o formato
// (ou de que a rede/IP foi bloqueado).
//
//   npm run diagnostico

import { diagnosticar } from '../src/maps/diagnostico.js';

const r = await diagnosticar();
for (const e of r.etapas) console.log(`${e.ok ? '✔' : '✖'} ${e.nome} (${(e.ms / 1000).toFixed(1)} s) — ${String(e.detalhe).slice(0, 200)}`);
console.log(r.ok ? '\nTudo compatível.' : '\nAlguma etapa falhou: o Google pode ter mudado o formato ou bloqueado este IP.');
process.exit(r.ok ? 0 : 1);
