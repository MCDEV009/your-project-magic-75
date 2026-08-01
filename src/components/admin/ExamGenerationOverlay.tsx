import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { GENERATION_TIPS } from '@/lib/examBlueprints';

interface Props {
  step: string;
  done: number;
  total: number;
}

export function ExamGenerationOverlay({ step, done, total }: Props) {
  const [tip, setTip] = useState(0);
  const pct = Math.min(100, Math.round((done / Math.max(1, total)) * 100));

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % GENERATION_TIPS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-6 text-center">
      <div className="relative mx-auto h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle cx="60" cy="60" r={R} className="fill-none stroke-muted" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={R}
            className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (C * pct) / 100}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-2xl font-bold tabular-nums">{pct}%</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{total}</span>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium">{step}</p>

      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[slide-in_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      </div>

      <p key={tip} className="mt-4 min-h-[2.5rem] text-xs text-muted-foreground animate-fade-in">
        💡 {GENERATION_TIPS[tip]}
      </p>

      <div className="mt-3 flex justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
