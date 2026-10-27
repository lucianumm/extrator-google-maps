import test from 'node:test';
import assert from 'node:assert/strict';
import { hostPermitido, origemPermitida } from '../src/seguranca.js';
import { ipPrivado, validarUrlPublica, ErroUrlBloqueada } from '../src/rede-segura.js';

test('hostPermitido aceita só loopback na porta certa', () => {
  assert.equal(hostPermitido('localhost:3210', 3210), true);
  assert.equal(hostPermitido('127.0.0.1:3210', 3210), true);
  assert.equal(hostPermitido('[::1]:3210', 3210), true);
  assert.equal(hostPermitido('evil.com:3210', 3210), false);
  assert.equal(hostPermitido('localhost:9999', 3210), false);
  assert.equal(hostPermitido('localhost.evil.com:3210', 3210), false);
  assert.equal(hostPermitido(undefined, 3210), false);
});

test('origemPermitida exige mesma origem quando há Origin', () => {
  assert.equal(origemPermitida(undefined, 'localhost:3210'), true);
  assert.equal(origemPermitida('http://localhost:3210', 'localhost:3210'), true);
  assert.equal(origemPermitida('https://evil.com', 'localhost:3210'), false);
  assert.equal(origemPermitida('null', 'localhost:3210'), false);
});

test('ipPrivado bloqueia redes internas (v4, v6 e v4 mapeado)', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(ipPrivado(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(ipPrivado(ip), false, ip);
});

test('validarUrlPublica recusa IP interno, localhost e protocolos estranhos', async () => {
  await assert.rejects(validarUrlPublica('http://127.0.0.1:3210/api/tarefas'), ErroUrlBloqueada);
  await assert.rejects(validarUrlPublica('http://[::1]/'), ErroUrlBloqueada);
  await assert.rejects(validarUrlPublica('http://169.254.169.254/latest/meta-data'), ErroUrlBloqueada);
  await assert.rejects(validarUrlPublica('http://localhost/'), ErroUrlBloqueada);
  await assert.rejects(validarUrlPublica('file:///etc/passwd'), ErroUrlBloqueada);
  await validarUrlPublica('http://8.8.8.8/');
});
