import test from 'node:test';
import assert from 'node:assert/strict';
import { limparPrefixo, analisarJsonGoogle, esperaDeNovaTentativa } from '../src/maps/cliente.js';

test('limparPrefixo remove proteção anti-hijacking', () => {
  assert.equal(limparPrefixo(")]}'\n[1,2]"), '[1,2]');
  assert.equal(limparPrefixo('/*""*/[1]/*""*/'), '[1]');
});

test('analisarJsonGoogle desembrulha {"d": "..."}', () => {
  assert.deepEqual(analisarJsonGoogle(JSON.stringify({ d: ")]}'\n[[1]]" })), [[1]]);
  assert.deepEqual(analisarJsonGoogle(")]}'\n[3]"), [3]);
});

test('esperaDeNovaTentativa: Retry-After tem prioridade; senão backoff exponencial com jitter', () => {
  const resp = (v) => ({ headers: { get: () => v } });
  assert.equal(esperaDeNovaTentativa(resp('7'), 30000, 0), 7000);
  for (const [tentativa, base] of [[0, 30000], [1, 60000], [2, 120000]]) {
    const e = esperaDeNovaTentativa(resp(null), 30000, tentativa);
    assert.ok(e >= base * 0.8 && e <= base * 1.2, `${tentativa}: ${e}`);
  }
});
