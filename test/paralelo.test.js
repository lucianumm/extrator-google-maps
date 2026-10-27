import test from 'node:test';
import assert from 'node:assert/strict';
import { emParalelo } from '../src/tarefas/gerenciador.js';
import { ErroBloqueio, ErroCancelado } from '../src/maps/cliente.js';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

test('emParalelo: uma falha aborta os demais trabalhadores e relança o primeiro erro', async () => {
  const controle = new AbortController();
  const iniciados = [];
  await assert.rejects(
    emParalelo(Array.from({ length: 50 }, (_, i) => i), 3, async (n) => {
      iniciados.push(n);
      await dormir(10);
      if (n === 1) throw new ErroBloqueio();
    }, controle),
    ErroBloqueio,
  );
  assert.equal(controle.signal.aborted, true);
  const aoTerminar = iniciados.length;
  await dormir(80);
  assert.equal(iniciados.length, aoTerminar, 'nenhum item novo começou depois da falha');
  assert.ok(aoTerminar < 10, `só ${aoTerminar} de 50 itens iniciaram`);
});

test('emParalelo: cancelamento do usuário lança ErroCancelado', async () => {
  const controle = new AbortController();
  const p = emParalelo([1, 2, 3, 4, 5, 6], 2, async () => { await dormir(10); }, controle);
  controle.abort();
  await assert.rejects(p, ErroCancelado);
});

test('emParalelo: processa todos os itens quando não há erro', async () => {
  const vistos = [];
  await emParalelo([1, 2, 3, 4, 5], 2, async (n) => { vistos.push(n); }, new AbortController());
  assert.deepEqual(vistos.sort(), [1, 2, 3, 4, 5]);
});
