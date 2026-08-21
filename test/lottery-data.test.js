import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraw, validateDraw } from '../api/lib/lottery-data.js';
import { buildStatistics, combinationScore } from '../src/services/lottery-analysis.js';

test('normaliza Powerball separando a bola especial', () => {
  const draw = normalizeDraw('Powerball', { draw_date: '2026-08-19T00:00:00.000', winning_numbers: '01 13 22 41 65 17', multiplier: '2' });
  assert.deepEqual(draw.white_numbers, [1, 13, 22, 41, 65]);
  assert.equal(draw.special_ball, 17);
});

test('normaliza Mega Millions separando a Mega Ball', () => {
  const draw = normalizeDraw('Mega Millions', { draw_date: '2026-08-18T00:00:00.000', winning_numbers: '04 18 31 48 69', mega_ball: '22' });
  assert.deepEqual(draw.white_numbers, [4, 18, 31, 48, 69]);
  assert.equal(draw.special_ball, 22);
});

test('rejeita números brancos duplicados ou fora da regra', () => {
  assert.throws(() => validateDraw('Powerball', { draw_date: '2026-08-19', white_numbers: [1, 1, 22, 41, 65], special_ball: 17 }));
  assert.throws(() => validateDraw('Mega Millions', { draw_date: '2026-08-19', white_numbers: [1, 2, 3, 4, 71], special_ball: 17 }));
});

test('calcula frequência e score transparente dentro da faixa', () => {
  const statistics = buildStatistics([{ white_numbers: [1, 2, 3, 4, 5] }, { white_numbers: [1, 6, 7, 8, 9] }], 69);
  const result = combinationScore([3, 17, 28, 42, 61], statistics, 69);
  assert.equal(statistics.frequency[1], 2);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.period, 2);
});
