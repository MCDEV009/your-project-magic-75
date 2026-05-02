import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

interface QuestionRow {
  id: string;
  question_text_uz: string;
  order_index: number;
}

function certificateLevel(percent: number) {
  if (percent >= 70) return { label: 'A+ — Oliy daraja', color: 'bg-success/20 text-success border-success/40', desc: 'Mukammal natija — Milliy sertifikat A+ darajasi' };
  if (percent >= 65) return { label: 'A — Yuqori daraja', color: 'bg-success/20 text-success border-success/40', desc: 'Yuqori natija — Milliy sertifikat A darajasi' };
  if (percent >= 60) return { label: "B+ — O'rta-yuqori daraja", color: 'bg-accent/20 text-accent border-accent/40', desc: "Yaxshi natija — Milliy sertifikat B+ darajasi" };
  if (percent >= 55) return { label: "B — O'rta daraja", color: 'bg-accent/20 text-accent border-accent/40', desc: "Qoniqarli natija — Milliy sertifikat B darajasi" };
  if (percent >= 50) return { label: "C+ — Boshlang'ich-yuqori daraja", color: 'bg-warning/20 text-warning border-warning/40', desc: "O'rtacha natija — Milliy sertifikat C+ darajasi" };
  if (percent >= 46) return { label: "C — Boshlang'ich daraja", color: 'bg-warning/20 text-warning border-warning/40', desc: "Minimal sertifikat darajasi — Milliy sertifikat C" };
  return { label: 'NC — Sertifikatsiz', color: 'bg-destructive/20 text-destructive border-destructive/40', desc: "Sertifikat olish uchun yetarli emas (45% va undan past) — qayta urinib ko'ring" };
}

export function QuestionStatsList({ attemptId }: Props) {
  const [stats, setStats] = useState<QStat[] | null>(null);
  const [questions, setQuestions] = useState<Record<string, QuestionRow>>({});
  const [typeFilter, setTypeFilter] = useState<'all' | 'single_choice' | 'written'>('all');
  const [topicQuery, setTopicQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data: statsData } = await supabase
        .from('question_analyses')
        .select('question_id, question_type, is_correct, points_earned, max_points')
        .eq('attempt_id', attemptId);
      const list = (statsData as QStat[]) || [];
      setStats(list);

      if (list.length > 0) {
        const ids = list.map(s => s.question_id);
        const { data: qs } = await supabase
          .from('questions')
          .select('id, question_text_uz, order_index')
          .in('id', ids);
        const map: Record<string, QuestionRow> = {};
        (qs || []).forEach((q: any) => { map[q.id] = q; });
        setQuestions(map);
      }
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

  const filteredStats = stats.filter(q => {
    if (typeFilter !== 'all' && q.question_type !== typeFilter) return false;
    if (topicQuery.trim()) {
      const text = (questions[q.question_id]?.question_text_uz || '').toLowerCase();
      if (!text.includes(topicQuery.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card className="shadow-card" id="question-stats-card">
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setTypeFilter('all')}
            >Barchasi</Button>
            <Button
              size="sm"
              variant={typeFilter === 'single_choice' ? 'default' : 'outline'}
              onClick={() => setTypeFilter('single_choice')}
            >Test</Button>
            <Button
              size="sm"
              variant={typeFilter === 'written' ? 'default' : 'outline'}
              onClick={() => setTypeFilter('written')}
            >Yozma</Button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mavzu/savol matni bo'yicha qidirish..."
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Per-question grid */}
        <div>
          <div className="text-sm font-medium mb-2">Savollar bo'yicha ball ({filteredStats.length}):</div>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {filteredStats.map((q, i) => {
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
            {filteredStats.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-4">
                Filtrga mos savollar topilmadi
              </div>
            )}
          </div>
        </div>

        {/* Detailed per-question list */}
        <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
          <div className="text-sm font-medium mb-2">Har bir savolning batafsil natijasi:</div>
          {[...filteredStats]
            .sort((a, b) => (questions[a.question_id]?.order_index ?? 0) - (questions[b.question_id]?.order_index ?? 0))
            .map((q, i) => {
              const earned = Number(q.points_earned || 0);
              const max = Number(q.max_points || 1);
              const pct = max > 0 ? (earned / max) * 100 : 0;
              const text = questions[q.question_id]?.question_text_uz || `Savol ${i + 1}`;
              const bg = pct === 100 ? 'border-success/40 bg-success/5'
                : pct === 0 ? 'border-destructive/40 bg-destructive/5'
                : 'border-warning/40 bg-warning/5';
              return (
                <div key={q.question_id} className={`flex items-start gap-2 p-2 rounded border ${bg}`}>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {q.question_type === 'written' ? 'Y' : 'T'}#{i + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{text}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={pct} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground shrink-0">{earned.toFixed(1)}/{max} ({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-success/10">Jami: {totalEarned.toFixed(1)} / {totalMax.toFixed(1)} ball</Badge>
        </div>
      </CardContent>
    </Card>
  );
}