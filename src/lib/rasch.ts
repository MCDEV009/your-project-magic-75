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

/* ------------------------------------------------------------------ *
 *  Rasch measurement engine — ability estimation & fit diagnostics
 * ------------------------------------------------------------------ */

export interface RaschResponse {
  /** Item difficulty in logits. */
  delta: number;
  /** Scored response, 0..1 (partial credit allowed for written items). */
  score: number;
}

export interface RaschEstimate {
  theta: number;
  /** Standard Error of Measurement (logits). */
  sem: number;
  infit: number;
  outfit: number;
  /** 0–100 scaled score. */
  scaled: number;
  /** True when the pattern is extreme (all right / all wrong). */
  extreme: boolean;
  iterations: number;
}

/**
 * Newton-Raphson (JMLE) estimation of latent ability theta.
 *   f(θ)  = Σ (x_i − P_i)
 *   f'(θ) = −Σ P_i (1 − P_i)
 *   θ ← θ + f(θ) / Σ P_i(1−P_i)
 */
export function estimateTheta(responses: RaschResponse[], maxIter = 50, tol = 1e-5): { theta: number; sem: number; extreme: boolean; iterations: number } {
  const n = responses.length;
  if (n === 0) return { theta: 0, sem: Infinity, extreme: true, iterations: 0 };

  const raw = responses.reduce((s, r) => s + r.score, 0);
  // Extreme scores have no finite MLE — nudge by 0.3 score points (Wright's correction).
  let extreme = false;
  let target = raw;
  if (raw <= 0) { target = 0.3; extreme = true; }
  else if (raw >= n) { target = n - 0.3; extreme = true; }

  let theta = 0;
  let iterations = 0;
  let info = 0;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;
    let expected = 0;
    info = 0;
    for (const r of responses) {
      const p = raschProbability(theta, r.delta);
      expected += p;
      info += p * (1 - p);
    }
    if (info < 1e-9) break;
    const step = (target - expected) / info;
    // Damp large steps for stability
    const damped = Math.max(-1.5, Math.min(1.5, step));
    theta += damped;
    if (Math.abs(damped) < tol) break;
  }

  theta = Math.max(-6, Math.min(6, theta));
  const sem = info > 1e-9 ? 1 / Math.sqrt(info) : Infinity;
  return { theta, sem, extreme, iterations };
}

/**
 * Infit (information-weighted) and Outfit (unweighted) mean-square fit statistics.
 * Values near 1.0 = ideal. >1.5 noisy (guessing/careless), <0.5 overly predictable.
 */
export function fitStatistics(responses: RaschResponse[], theta: number): { infit: number; outfit: number } {
  let sumZ2 = 0;
  let sumWZ2 = 0;
  let sumW = 0;
  let count = 0;

  for (const r of responses) {
    const p = raschProbability(theta, r.delta);
    const w = p * (1 - p);
    if (w < 1e-9) continue;
    const residual = r.score - p;
    const z2 = (residual * residual) / w;
    sumZ2 += z2;
    sumWZ2 += w * z2;
    sumW += w;
    count++;
  }

  const outfit = count > 0 ? sumZ2 / count : 1;
  const infit = sumW > 1e-9 ? sumWZ2 / sumW : 1;
  return { infit, outfit };
}

/** Convert theta (logits) into a 0–100 BMBA scaled score. */
export function thetaToScaled(theta: number, min = -4, max = 4): number {
  const clamped = Math.max(min, Math.min(max, theta));
  return Math.round(((clamped - min) / (max - min)) * 100 * 10) / 10;
}

/** Full Rasch run: theta + SEM + fit + scaled score. */
export function runRasch(responses: RaschResponse[]): RaschEstimate {
  const { theta, sem, extreme, iterations } = estimateTheta(responses);
  const { infit, outfit } = fitStatistics(responses, theta);
  return { theta, sem, infit, outfit, scaled: thetaToScaled(theta), extreme, iterations };
}

export type BmbaGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'NC';

export interface BmbaGradeInfo {
  grade: BmbaGrade;
  label: string;
  desc: string;
  /** Tailwind classes built on design tokens. */
  color: string;
  glow: boolean;
}

/** Official BMBA grade bands (percentage of maximum score). */
export function bmbaGrade(pct: number): BmbaGradeInfo {
  if (pct >= 86) return { grade: 'A+', label: "A+ — Oliy daraja", desc: 'Mukammal natija (86–100%)', color: 'bg-primary/15 text-primary border-primary/50', glow: true };
  if (pct >= 80) return { grade: 'A', label: 'A — Yuqori daraja', desc: 'Yuqori natija (80–85.9%)', color: 'bg-primary/10 text-primary border-primary/40', glow: false };
  if (pct >= 75) return { grade: 'B+', label: "B+ — O'rta-yuqori daraja", desc: 'Yaxshi natija (75–79.9%)', color: 'bg-accent/15 text-accent border-accent/40', glow: false };
  if (pct >= 70) return { grade: 'B', label: "B — O'rta daraja", desc: 'Qoniqarli natija (70–74.9%)', color: 'bg-accent/10 text-accent border-accent/30', glow: false };
  if (pct >= 65) return { grade: 'C+', label: "C+ — Boshlang'ich-yuqori daraja", desc: "O'rtacha natija (65–69.9%)", color: 'bg-warning/15 text-warning border-warning/40', glow: false };
  if (pct >= 60) return { grade: 'C', label: "C — Boshlang'ich daraja", desc: 'Minimal sertifikat darajasi (60–64.9%)', color: 'bg-warning/10 text-warning border-warning/30', glow: false };
  return { grade: 'NC', label: 'Sertifikat berilmaydi', desc: "60% dan past — qayta urinib ko'ring", color: 'bg-destructive/10 text-destructive border-destructive/40', glow: false };
}

/** Interpretation helper for fit statistics. */
export function fitVerdict(infit: number, outfit: number): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  const worst = Math.max(infit, outfit);
  if (worst > 2) return { label: "Juda ko'p tasodifiy javob — taxmin qilish alomati", tone: 'bad' };
  if (worst > 1.5) return { label: "Ehtiyotsiz xatolar yoki taxmin belgilari", tone: 'warn' };
  if (Math.min(infit, outfit) < 0.5) return { label: 'Javoblar juda bir xil (ortiqcha bashoratli)', tone: 'warn' };
  return { label: "Javoblar modelga mos — ishonchli o'lchov", tone: 'ok' };
}