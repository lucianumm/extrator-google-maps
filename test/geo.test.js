import test from 'node:test';
import assert from 'node:assert/strict';
import { circulo, gerarGrade, pontoNaGeometria, validarGeoJson } from '../src/geo/grade.js';

test('círculo contém o centro e exclui ponto distante', () => {
  const c = circulo(-16.68, -49.25, 2);
  assert.equal(pontoNaGeometria(-16.68, -49.25, c), true);
  assert.equal(pontoNaGeometria(-16.5, -49.25, c), false);
});

test('gerarGrade só devolve pontos dentro da área e cai no centro se a área é pequena', () => {
  const c = circulo(-16.68, -49.25, 3);
  const pontos = gerarGrade(c, 1);
  assert.ok(pontos.length > 5);
  assert.ok(pontos.every((p) => pontoNaGeometria(p.lat, p.lon, c)));
  assert.equal(gerarGrade(circulo(0, 0, 0.1), 5).length, 1);
});

test('validarGeoJson aponta entradas inválidas', () => {
  assert.match(validarGeoJson({ type: 'Point' }), /Polygon/);
  assert.equal(validarGeoJson(circulo(0, 0, 1)), null);
});
