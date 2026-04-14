import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Brain, Target, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardAnalysis {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  risk_students_percent?: number;
}

interface TestStat {
  name: string;
  attempts: number;
  avgScore: number;
}

interface DashboardData {
  totalAttempts: number;
  avgScore: string;
  testStats: Record<string, TestStat>;
  analysis: DashboardAnalysis;
}

export function AIAnalyticsDashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-results', {
        body: { analysis_type: 'dashboard' },
      });

      if (error) throw error;
      if (result?.error) {
        if (result.error.includes('Rate limit')) {
          toast.error("So'rovlar limiti oshdi");
        } else if (result.error.includes('Credits')) {
          toast.error("AI krediti tugagan");
        } else {
          throw new Error(result.error);
        }
        return;
      }

      setData(result);
    } catch (err: any) {
      console.error('Dashboard analysis error:', err);
      toast.error('Tahlil qilishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Tahlil Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/40" />
          <p className="text-muted-foreground mb-4">
            AI yordamida barcha test natijalarini tahlil qiling
          </p>
          <Button onClick={handleAnalyze} disabled={loading} className="gap-2 gradient-primary border-0">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Tahlil qilinmoqda...</>
            ) : (
              <><Sparkles className="h-4 w-4" />Tahlilni boshlash</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const analysis = data.analysis;

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-6 w-6 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{data.totalAttempts}</div>
            <div className="text-xs text-muted-foreground">Jami urinishlar</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-1 text-accent" />
            <div className="text-2xl font-bold">{data.avgScore}</div>
            <div className="text-xs text-muted-foreground">O'rtacha ball</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Target className="h-6 w-6 mx-auto mb-1 text-success" />
            <div className="text-2xl font-bold">{Object.keys(data.testStats).length}</div>
            <div className="text-xs text-muted-foreground">Testlar</div>
          </CardContent>
        </Card>
        {analysis.risk_students_percent !== undefined && (
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-destructive" />
              <div className="text-2xl font-bold">{analysis.risk_students_percent}%</div>
              <div className="text-xs text-muted-foreground">Risk guruhi</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Analysis */}
      <Card className="shadow-card border-primary/20 overflow-hidden">
        <div className="h-1 gradient-primary" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Tahlil
            <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={loading} className="ml-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yangilash'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.summary && (
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.strengths && analysis.strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-success">
                  <Target className="h-4 w-4" />Kuchli tomonlar
                </div>
                <ul className="space-y-1 pl-6">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground list-disc">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.weaknesses && analysis.weaknesses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />Zaif tomonlar
                </div>
                <ul className="space-y-1 pl-6">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground list-disc">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-primary">Tavsiyalar</div>
              <div className="space-y-2">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm">
                    <Badge variant="outline" className="shrink-0 mt-0.5">{i + 1}</Badge>
                    <span className="text-muted-foreground">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-test stats */}
      {Object.keys(data.testStats).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Testlar bo'yicha statistika</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.values(data.testStats).map((stat, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="font-medium text-sm">{stat.name}</div>
                    <div className="text-xs text-muted-foreground">{stat.attempts} urinish</div>
                  </div>
                  <Badge variant="secondary">{stat.avgScore.toFixed(1)} ball</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
