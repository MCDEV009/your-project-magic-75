// Shared Rasch (1PL) helpers used by the scoring Edge Functions
// (evaluate-written-answers and finalize-live-session), so both compute
// ability, item difficulty and T-scores in exactly the same way.
// Pure TypeScript: no Deno or runtime-specific APIs.

export interface RaschResponse {
  correct: boolean;
  /** Item difficulty in logits (higher = harder). */
  difficulty: number;
}

/** Rasch probability P = e^(θ − b) / (1 + e^(θ − b)), numerically stable. */
export function raschProbability(theta: number, difficulty: number): number {
  const x = theta - difficulty;
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const z = Math.exp(x);
  return z / (1 + z);
}

/**
 * Estimate ability θ with Newton-Raphson.
 * All-wrong / all-right patterns have no finite MLE and map to −3 / +3.
 */
export function estimateAbility(responses: RaschResponse[]): number {
  if (responses.length === 0) return 0;

  const totalCorrect = responses.filter((r) => r.correct).length;
  if (totalCorrect === 0) return -3;
  if (totalCorrect === responses.length) return 3;

  let theta = 0;
  for (let iter = 0; iter < 50; iter++) {
    let sumP = 0;
    let sumPQ = 0;
    for (const r of responses) {
      const p = raschProbability(theta, r.difficulty);
      sumP += p;
      sumPQ += p * (1 - p);
    }
    if (sumPQ < 1e-9) break;
    // Newton-Raphson update: θ ← θ + (X − Σp) / ΣpQ, with a damped step for stability.
    const adjustment = Math.max(-1.5, Math.min(1.5, (totalCorrect - sumP) / sumPQ));
    theta += adjustment;
    if (Math.abs(adjustment) < 0.001) break;
  }

  return Math.max(-4, Math.min(4, theta));
}

/**
 * Item difficulty from the empirical proportion correct: b = −ln(p / (1 − p)).
 * The proportion is clamped to [0.01, 0.99] so no item gets an infinite difficulty.
 */
export function estimateItemDifficulties(
  allAttempts: { answers?: Record<string, number> | null }[],
  questions: { id: string; correct_option: number }[],
): Map<string, number> {
  const difficulties = new Map<string, number>();

  for (const q of questions) {
    let correct = 0;
    let total = 0;
    for (const attempt of allAttempts) {
      const given = attempt.answers?.[q.id];
      if (given !== undefined) {
        total++;
        if (given === q.correct_option) correct++;
      }
    }
    const p = total > 0 ? Math.max(0.01, Math.min(0.99, correct / total)) : 0.5;
    difficulties.set(q.id, -Math.log(p / (1 - p)));
  }

  return difficulties;
}

/** T-score: T = 50 + 10·Z, Z = (θ − μ) / σ over all abilities (population σ). */
export function calculateTScore(theta: number, allThetas: number[]): number {
  if (allThetas.length <= 1) return Math.round(50 + 10 * theta);

  const mean = allThetas.reduce((a, b) => a + b, 0) / allThetas.length;
  const variance = allThetas.reduce((a, b) => a + (b - mean) ** 2, 0) / allThetas.length;
  const stdDev = Math.sqrt(variance) || 1;
  return Math.round(50 + 10 * ((theta - mean) / stdDev));
}
