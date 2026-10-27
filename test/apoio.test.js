import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RAIZ } from '../src/caminhos.js';
import path from 'node:path';

const apoio = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'apoio.json'), 'utf8'));

function crc16(texto) {
  let c = 0xffff;
  for (const b of Buffer.from(texto, 'utf8')) {
    c ^= b << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}

test('apoio.json: código Pix copia e cola tem CRC válido e bate com a chave informada', () => {
  const p = apoio.copiaECola;
  assert.equal(crc16(p.slice(0, -4)), p.slice(-4), 'CRC16 do payload Pix não confere (código alterado ou corrompido)');
  assert.ok(p.startsWith('000201'));
  assert.ok(p.includes('br.gov.bcb.pix'));
  assert.ok(p.includes(apoio.chave), 'a chave exibida não está no código copia e cola');
  assert.ok(p.includes(apoio.favorecido));
});

test('apoio.json: a imagem do QR Code existe', () => {
  assert.ok(fs.existsSync(path.join(RAIZ, 'publico', apoio.qr)), `${apoio.qr} não encontrado em publico/`);
});
