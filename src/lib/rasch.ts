/**
 * Rasch Model (1-parameter logistic IRT)
 *
 * Logit equation:
 *   ln( P / (1 - P) ) = theta - delta
 *
 * Solving for P (probability of a correct response):
 *   P(theta, delta) = 1 / (1 + exp(-(theta - delta)))
 *
 *   theta — latent ability of the test-taker (logits)
 *   delta — difficulty of the item (logits)
 */

/** Probability of a correct answer under the Rasch model. */
export function raschProbability(theta: number, delta: number): number {
  const x = theta - delta;
  // Numerically stable sigmoid
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

/** Logit transform — inverse of the sigmoid. */
export function logit(p: number): number {
  const eps = 1e-6;
  const clamped = Math.min(1 - eps, Math.max(eps, p));
  return Math.log(clamped / (1 - clamped));
}

/**
 * Estimate item difficulty (delta) from an empirical proportion-correct.
 * delta = -ln( p / (1 - p) ) = logit(1 - p)
 * Higher delta => harder item.
 */
export function estimateDeltaFromPCorrect(pCorrect: number): number {
  return -logit(pCorrect);
}

/** Format a probability (0..1) as a percentage string. */
export function formatProbability(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/** Qualitative bucket for UI styling. */
export function probabilityBucket(p: number): 'high' | 'mid' | 'low' {
  if (p >= 0.7) return 'high';
  if (p >= 0.4) return 'mid';
  return 'low';
}