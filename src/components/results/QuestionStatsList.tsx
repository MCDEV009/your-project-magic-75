import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Loader2 } from 'lucide-react';

interface Props {
  attemptId: string;
}

interface QStat {
  question_id: string;
  question_type: string;
  is_correct: boolean | null;
  points_earned: number;
  max_points: number;
}

function certificateLevel(percent: number) {
  if (percent >= 90) return { label: 'A+ — Oliy daraja', color: 'bg-success/20 text-success border-success/40', desc: 'Mukammal natija — Milliy sertifikat A+ darajasiga mos' };
  if (percent >= 75) return { label: 'A — Yuqori daraja', color: 'bg-success/20 text-success border-success/40', desc: 'Yaxshi natija — Milliy sertifikat A darajasi' };
  if (percent >= 60) return { label: 'B — O\'rta daraja', color: 'bg-accent/20 text-accent border-accent/40', desc: 'Qoniqarli — Milliy sertifikat B darajasi' };
  if (percent >= 45) return { label: 'C — Boshlang\'ich daraja', color: 'bg-warning/20 text-warning border-warning/40', desc: 'O\'rtacha — Milliy sertifikat C darajasi' };
  return { label: 'F — Sertifikatsiz', color: 'bg-destructive/20 text-destructive border-destructive/40', desc: 'Sertifikat olish uchun yetarli emas — qayta urinib ko\'ring' };
}

export function QuestionStatsList({ attemptId }: Props) {
  const [stats, setStats] = useState<QStat[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('question_analyses')
        .select('question_id, question_type, is_correct, points_earned, max_points')
        .eq('attempt_id', attemptId);
      setStats((data as QStat[]) || []);
    })();
  }, [attemptId]);

  if (!stats) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </CardContent></Card>
    );
  }

  const totalEarned = stats.reduce((s, q) => s + Number(q.points_earned || 0), 0);
  const totalMax = stats.reduce((s, q) => s + Number(q.max_points || 0), 0);
  const overallPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
  const cert = certificateLevel(overallPct);

  const correctCount = stats.filter(q => q.is_correct === true).length;
  const wrongCount = stats.filter(q => q.is_correct === false).length;
  const partialCount = stats.filter(q => q.is_correct === null && Number(q.points_earned) > 0).length;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Har bir savol statistikasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Certificate Level */}
        <div className={`p-4 rounded-lg border-2 ${cert.color}`}>
          <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Sertifikat darajasi</div>
          <div className="text-2xl font-bold">{cert.label}</div>
          <div className="text-sm mt-1 opacity-90">{cert.desc}</div>
          <div className="mt-3">
            <Progress value={overallPct} className="h-2" />
            <div className="text-xs mt-1 text-right opacity-80">{overallPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-success/10">
            <div className="text-xl font-bold text-success">{correctCount}</div>
            <div className="text-xs text-muted-foreground">To'g'ri</div>
          </div>
          <div className="p-2 rounded bg-warning/10">
            <div className="text-xl font-bold text-warning">{partialCount}</div>
            <div className="text-xs text-muted-foreground">Qisman</div>
          </div>
          <div className="p-2 rounded bg-destructive/10">
            <div className="text-xl font-bold text-destructive">{wrongCount}</div>
            <div className="text-xs text-muted-foreground">Noto'g'ri</div>
          </div>
        </div>

        {/* Per-question grid */}
        <div>
          <div className="text-sm font-medium mb-2">Savollar bo'yicha ball:</div>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {stats.map((q, i) => {
              const earned = Number(q.points_earned || 0);
              const max = Number(q.max_points || 1);
              const pct = max > 0 ? earned / max : 0;
              const bg =
                pct === 1 ? 'bg-success/20 border-success/40 text-success'
                : pct === 0 ? 'bg-destructive/20 border-destructive/40 text-destructive'
                : 'bg-warning/20 border-warning/40 text-warning';
              return (
                <div
                  key={q.question_id}
                  className={`p-2 rounded border text-center ${bg}`}
                  title={`Savol ${i + 1}: ${earned}/${max}`}
                >
                  <div className="text-[10px] opacity-70">#{i + 1}</div>
                  <div className="text-xs font-bold">{earned.toFixed(1)}</div>
                  <div className="text-[9px] opacity-60">/{max}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-success/10">Jami: {totalEarned.toFixed(1)} / {totalMax.toFixed(1)} ball</Badge>
        </div>
      </CardContent>
    </Card>
  );
}