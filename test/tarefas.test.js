import test from 'node:test';
import assert from 'node:assert/strict';
import { recomendarEmails } from '../src/contatos/verificar.js';
import { paraCsv } from '../src/exportar.js';
import { escreverAtomico } from '../src/arquivo.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('recomendarEmails prefere o domínio do site e descarta no-reply', () => {
  const r = recomendarEmails(['noreply@empresa.com.br', 'contato@empresa.com.br', 'joao@gmail.com'], 'https://www.empresa.com.br', 3);
  assert.equal(r[0], 'contato@empresa.com.br');
  assert.ok(!r.includes('noreply@empresa.com.br'));
});

test('paraCsv usa ; , BOM e escapa aspas e quebras de linha', () => {
  const csv = paraCsv([{ nome: 'Padaria "Boa"; Ltda', categorias: ['A', 'B'], nota: 4.5, avaliacoes: 10 }]);
  assert.ok(csv.startsWith('﻿Nome;'));
  assert.ok(csv.includes('"Padaria ""Boa""; Ltda"'));
  assert.ok(csv.includes('4,5'));
});

test('escreverAtomico substitui o arquivo sem deixar temporário', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extrator-'));
  const alvo = path.join(dir, 'a.json');
  escreverAtomico(alvo, '1');
  escreverAtomico(alvo, '2');
  assert.equal(fs.readFileSync(alvo, 'utf8'), '2');
  assert.deepEqual(fs.readdirSync(dir), ['a.json']);
  fs.rmSync(dir, { recursive: true });
});
