import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Award, Activity, Gauge } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import {
  runRasch, bmbaGrade, fitVerdict, estimateDeltaFromPCorrect,
  raschProbability, type RaschResponse,
} from '@/lib/rasch';

interface Props {
  attemptId: string;
  /** Overall percentage of maximum score (for the certificate band). */
  percentage: number;
}

interface Row {
  question_id: string;
  question_type: string;
  is_correct: boolean | null;
  points_earned: number;
  max_points: number;
  p_correct: number | null;
  order_index: number;
  delta: number;
  score: number;
}

export function RaschDiagnostics({ attemptId, percentage }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: stats } = await supabase
        .from('question_analyses')
        .select('question_id, question_type, is_correct, points_earned, max_points, p_correct')
        .eq('attempt_id', attemptId);

      const list = (stats as any[]) || [];
      if (list.length === 0) { if (!cancelled) setRows([]); return; }

      const ids = list.map((s) => s.question_id);
      const [{ data: qs }, { data: an }] = await Promise.all([
        supabase.from('questions_public' as any).select('id, order_index').in('id', ids),
        supabase.from('question_analytics').select('question_id, total_attempts, correct_count').in('question_id', ids),
      ]);

      const orderMap: Record<string, number> = {};
      (qs as any[] | null)?.forEach((q) => { orderMap[q.id] = q.order_index ?? 0; });
      const pMap: Record<string, number> = {};
      (an as any[] | null)?.forEach((a) => {
        const total = Number(a.total_attempts || 0);
        // Bayes smoothing (prior 0.5, strength 4)
        pMap[a.question_id] = (Number(a.correct_count || 0) + 2) / (total + 4);
      });

      const built: Row[] = list.map((s) => {
        const p = s.p_correct != null ? Number(s.p_correct) : (pMap[s.question_id] ?? 0.5);
        const max = Number(s.max_points || 1);
        const earned = Number(s.points_earned || 0);
        return {
          question_id: s.question_id,
          question_type: s.question_type,
          is_correct: s.is_correct,
          points_earned: earned,
          max_points: max,
          p_correct: p,
          order_index: orderMap[s.question_id] ?? 0,
          delta: estimateDeltaFromPCorrect(p),
          score: max > 0 ? Math.max(0, Math.min(1, earned / max)) : 0,
        };
      }).sort((a, b) => a.order_index - b.order_index);

      if (!cancelled) setRows(built);
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  const estimate = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const responses: RaschResponse[] = rows.map((r) => ({ delta: r.delta, score: r.score }));
    return runRasch(responses);
  }, [rows]);

  if (!rows) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </CardContent></Card>
    );
  }

  if (rows.length === 0 || !estimate) return null;

  const grade = bmbaGrade(percentage);
  const verdict = fitVerdict(estimate.infit, estimate.outfit);
  const verdictClass =
    verdict.tone === 'ok' ? 'text-success' : verdict.tone === 'warn' ? 'text-warning' : 'text-destructive';

  // Wright map data: items on the X axis (question order), difficulty on Y axis.
  const itemPoints = rows.map((r, i) => ({
    x: i + 1,
    y: Number(r.delta.toFixed(2)),
    correct: r.score >= 0.999,
    partial: r.score > 0 && r.score < 0.999,
    prob: raschProbability(estimate.theta, r.delta),
    type: r.question_type,
  }));

  return (
    <div className="space-y-4">
      {/* Certificate */}
      <Card className={`shadow-elevated border-2 ${grade.color.split(' ').filter((c) => c.startsWith('border')).join(' ')} ${grade.glow ? 'shadow-glow' : ''}`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 ${grade.color} ${grade.glow ? 'animate-pulse-glow' : ''}`}>
              <span className="text-3xl font-bold">{grade.grade}</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Award className="h-3.5 w-3.5" /> BMBA Rasmiy Baho
              </div>
              <div className="text-2xl font-bold mt-1">{grade.label}</div>
              <div className="text-sm text-muted-foreground">{grade.desc}</div>
              <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge variant="outline">Foiz: {percentage.toFixed(1)}%</Badge>
                <Badge variant="outline">Rasch shkalasi: {estimate.scaled.toFixed(1)}/100</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Measurement metrics */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-5 w-5 text-primary" />
            Rasch o'lchov ko'rsatkichlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg border bg-muted/40">
              <div className="text-[11px] text-muted-foreground">Qobiliyat (θ)</div>
              <div className="text-xl font-bold text-primary tabular-nums">{estimate.theta.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">logit</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/40">
              <div className="text-[11px] text-muted-foreground">SEM</div>
              <div className="text-xl font-bold tabular-nums">±{Number.isFinite(estimate.sem) ? estimate.sem.toFixed(2) : '—'}</div>
              <div className="text-[10px] text-muted-foreground">o'lchov xatosi</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/40">
              <div className="text-[11px] text-muted-foreground">Infit MNSQ</div>
              <div className="text-xl font-bold tabular-nums">{estimate.infit.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">ideal ≈ 1.00</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/40">
              <div className="text-[11px] text-muted-foreground">Outfit MNSQ</div>
              <div className="text-xl font-bold tabular-nums">{estimate.outfit.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">ideal ≈ 1.00</div>
            </div>
          </div>

          <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${verdictClass}`}>
            <Activity className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Diagnostika: {verdict.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Ishonch oralig'i: θ = {estimate.theta.toFixed(2)} ± {Number.isFinite(estimate.sem) ? (1.96 * estimate.sem).toFixed(2) : '—'} (95%)
                {estimate.extreme && ' · ekstremal natija uchun tuzatish qo\'llanildi'}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            P(X=1 | θ, b) = e^(θ−b) / (1 + e^(θ−b)) · θ Newton–Raphson iteratsiyasi bilan baholandi
            ({estimate.iterations} qadam, {rows.length} savol).
          </p>
        </CardContent>
      </Card>

      {/* Wright map */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Wright xaritasi (Shaxs–Savol xaritasi)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Gorizontal chiziq — sizning qobiliyatingiz (θ). Chiziqdan pastdagi savollar siz uchun oson, yuqoridagilari qiyin.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 12, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number" dataKey="x" name="Savol"
                  domain={[0, itemPoints.length + 1]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Savol raqami', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  type="number" dataKey="y" name="Qiyinlik (logit)"
                  domain={[-4, 4]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  width={40}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: any, name: string) => [value, name]}
                  labelFormatter={() => ''}
                />
                <ReferenceLine
                  y={Number(estimate.theta.toFixed(2))}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  label={{ value: `θ = ${estimate.theta.toFixed(2)}`, position: 'right', fontSize: 11, fill: 'hsl(var(--primary))' }}
                />
                <Scatter data={itemPoints}>
                  {itemPoints.map((p, i) => (
                    <Cell
                      key={i}
                      fill={p.correct ? 'hsl(var(--success))' : p.partial ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> To'g'ri</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Qisman</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Noto'g'ri</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-primary inline-block" /> Sizning θ</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}