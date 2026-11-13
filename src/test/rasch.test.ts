import { describe, expect, it } from 'vitest';
import {
  raschProbability,
  estimateTheta,
  fitStatistics,
  thetaToScaled,
  bmbaGrade,
  runRasch,
  estimateDeltaFromPCorrect,
} from '@/lib/rasch';
import {
  raschProbability as sharedProbability,
  estimateAbility,
  estimateItemDifficulties,
  calculateTScore,
} from '../../supabase/functions/_shared/rasch';

const items = (deltas: number[], scores: number[]) =>
  deltas.map((delta, i) => ({ delta, score: scores[i] }));

describe('src/lib/rasch', () => {
  it('gives 50% when ability equals difficulty and is monotonic', () => {
    expect(raschProbability(1, 1)).toBeCloseTo(0.5, 10);
    expect(raschProbability(2, 0)).toBeGreaterThan(raschProbability(1, 0));
    expect(raschProbability(-800, 0)).toBeGreaterThanOrEqual(0);
    expect(raschProbability(800, 0)).toBeLessThanOrEqual(1);
  });

  it('estimates theta so that expected score matches the raw score', () => {
    const deltas = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
    const r = items(deltas, [1, 1, 1, 1, 0, 0, 0, 0]);
    const { theta, extreme } = estimateTheta(r);
    const expected = deltas.reduce((s, d) => s + raschProbability(theta, d), 0);
    expect(extreme).toBe(false);
    expect(expected).toBeCloseTo(4, 3);
  });

  it('flags extreme patterns and keeps theta finite and in range', () => {
    const deltas = [-1, 0, 1];
    const allRight = estimateTheta(items(deltas, [1, 1, 1]));
    const allWrong = estimateTheta(items(deltas, [0, 0, 0]));
    expect(allRight.extreme && allWrong.extreme).toBe(true);
    expect(allRight.theta).toBeGreaterThan(0);
    expect(allWrong.theta).toBeLessThan(0);
    expect(Math.abs(allRight.theta)).toBeLessThanOrEqual(6);
    expect(estimateTheta([]).theta).toBe(0);
  });

  it('is more able for a higher raw score', () => {
    const d = [-1, -0.5, 0, 0.5, 1];
    const low = estimateTheta(items(d, [1, 0, 0, 0, 0])).theta;
    const high = estimateTheta(items(d, [1, 1, 1, 1, 0])).theta;
    expect(high).toBeGreaterThan(low);
  });

  it('reports fit near 1 for a model-consistent pattern and high for a reversed one', () => {
    const d = [-2, -1, 0, 1, 2];
    const good = fitStatistics(items(d, [1, 1, 1, 0, 0]), 0.3);
    const bad = fitStatistics(items(d, [0, 0, 1, 1, 1]), 0.3);
    expect(bad.outfit).toBeGreaterThan(good.outfit);
    expect(bad.infit).toBeGreaterThan(good.infit);
  });

  it('scales theta to 0-100 and clamps', () => {
    expect(thetaToScaled(0)).toBe(50);
    expect(thetaToScaled(-10)).toBe(0);
    expect(thetaToScaled(10)).toBe(100);
    expect(runRasch(items([-1, 0, 1], [1, 1, 0])).scaled).toBeGreaterThan(0);
  });

  it('maps percentages to the official grade bands at their boundaries', () => {
    const g = (p: number) => bmbaGrade(p).grade;
    expect([g(100), g(86), g(85.9), g(80), g(79.9), g(75), g(74.9)]).toEqual(['A+', 'A+', 'A', 'A', 'B+', 'B+', 'B']);
    expect([g(70), g(69.9), g(65), g(64.9), g(60), g(59.9), g(0)]).toEqual(['B', 'C+', 'C+', 'C', 'C', 'NC', 'NC']);
  });

  it('gives harder items a higher delta', () => {
    expect(estimateDeltaFromPCorrect(0.2)).toBeGreaterThan(estimateDeltaFromPCorrect(0.8));
  });
});

describe('supabase/functions/_shared/rasch', () => {
  it('matches the client probability function', () => {
    for (const [t, d] of [[0, 0], [1.2, -0.4], [-2, 1]]) {
      expect(sharedProbability(t, d)).toBeCloseTo(raschProbability(t, d), 12);
    }
  });

  it('estimates ability so the expected score matches and handles extremes', () => {
    const resp = [-1, -0.5, 0, 0.5, 1].map((difficulty, i) => ({ correct: i < 3, difficulty }));
    const theta = estimateAbility(resp);
    const expected = resp.reduce((s, r) => s + sharedProbability(theta, r.difficulty), 0);
    expect(expected).toBeCloseTo(3, 2);
    expect(estimateAbility([])).toBe(0);
    expect(estimateAbility(resp.map((r) => ({ ...r, correct: false })))).toBe(-3);
    expect(estimateAbility(resp.map((r) => ({ ...r, correct: true })))).toBe(3);
  });

  it('derives item difficulty from proportion correct, clamped', () => {
    const qs = [{ id: 'easy', correct_option: 0 }, { id: 'hard', correct_option: 0 }, { id: 'none', correct_option: 0 }];
    const attempts = Array.from({ length: 10 }, (_, i) => ({ answers: { easy: 0, hard: i === 0 ? 0 : 1 } }));
    const b = estimateItemDifficulties(attempts, qs);
    expect(b.get('easy')!).toBeLessThan(0);
    expect(b.get('hard')!).toBeGreaterThan(0);
    expect(b.get('none')).toBeCloseTo(0, 10);
    expect(Math.abs(b.get('easy')!)).toBeLessThanOrEqual(Math.log(99) + 1e-9);
    expect(estimateItemDifficulties([{ answers: null }], qs).get('easy')).toBeCloseTo(0, 10);
  });

  it('computes T-scores around 50 with sd 10', () => {
    expect(calculateTScore(1, [1])).toBe(60);
    const thetas = [-1, 0, 1];
    const t = thetas.map((x) => calculateTScore(x, thetas));
    expect(t[1]).toBe(50);
    expect(t[2]).toBeGreaterThan(50);
    expect(t[0]).toBeLessThan(50);
  });
});
