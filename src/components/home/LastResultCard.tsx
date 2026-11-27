import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import type { BmbaGradeInfo } from '@/lib/rasch';
import type { LastAttempt } from '@/hooks/useLastAttempt';

function formatDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

interface Props {
  attempt: LastAttempt | null;
  pct: number | null;
  gradeInfo: BmbaGradeInfo | null;
  loading: boolean;
}

export function LastResultCard({ attempt, pct, gradeInfo, loading }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-lg border bg-card/90 p-5 backdrop-blur-md">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-14 w-40" />
        <Skeleton className="mt-4 h-4 w-48" />
      </div>
    );
  }
  if (!attempt || !gradeInfo || pct === null) return null;

  return (
    <div className={`rounded-lg border bg-card/90 p-5 backdrop-blur-md ${gradeInfo.glow ? 'shadow-[0_0_32px_-8px_hsl(var(--primary)/0.55)]' : ''}`}>
      <p className="text-sm font-medium text-muted-foreground">Oxirgi mock natijasi</p>
      <div className="mt-3 flex items-center gap-4">
        <span className={`rounded-md border px-3 py-1 font-serif text-5xl leading-none ${gradeInfo.color}`}>
          {gradeInfo.grade}
        </span>
        <div>
          <div className="font-serif text-2xl text-foreground">{pct}%</div>
          <div className="text-sm text-muted-foreground">{gradeInfo.label}</div>
        </div>
      </div>
      {gradeInfo.grade === 'NC' && (
        <p className="mt-3 text-sm text-muted-foreground">{gradeInfo.desc}</p>
      )}
      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        {attempt.title && <p className="truncate font-medium text-foreground">{attempt.title}</p>}
        <p>
          {formatDate(attempt.submitted_at)}
          {attempt.total_questions != null && ` · ${attempt.correct_answers ?? 0} / ${attempt.total_questions} to'g'ri javob`}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={() => navigate(`/results/${attempt.id}`)}>
        Batafsil natija <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
