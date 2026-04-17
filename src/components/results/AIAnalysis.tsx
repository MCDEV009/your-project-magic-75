import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Brain, Target, AlertTriangle, BookOpen, Award, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface Analysis {
  overall_assessment?: string;
  strengths?: string[];
  weaknesses?: string[];
  unmastered_topics?: string[];
  recommendations?: string[];
  study_plan?: string;
  grade?: string;
}

interface AIAnalysisProps {
  attemptId: string;
}

const AI_NAME = "Al Xorazmiy";

export function AIAnalysis({ attemptId }: AIAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-results', {
        body: { attempt_id: attemptId, analysis_type: 'individual' },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error("So'rovlar limiti oshdi, biroz kutib turing");
        } else if (data.error.includes('Credits')) {
          toast.error("AI krediti tugagan");
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error('Analysis error:', err);
      toast.error('Tahlil qilishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger once on mount
  useEffect(() => {
    if (!autoTried && !analysis && !loading) {
      setAutoTried(true);
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!analysis) {
    return (
      <Card className="shadow-card border-primary/20">
        <CardContent className="py-6 text-center">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 text-primary/60" />
          <p className="text-sm font-semibold mb-1">{AI_NAME}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {loading ? "Natijalaringiz tahlil qilinmoqda..." : "Sun'iy intellekt yordamida natijalarni tahlil qiling"}
          </p>
          <Button onClick={handleAnalyze} disabled={loading} className="gap-2 gradient-primary border-0">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Tahlil qilinmoqda...</>
            ) : (
              <><Sparkles className="h-4 w-4" />Qayta tahlil qilish</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const gradeColor: Record<string, string> = {
    A: 'bg-success/20 text-success',
    B: 'bg-accent/20 text-accent',
    C: 'bg-warning/20 text-warning',
    D: 'bg-orange-200 text-orange-700',
    F: 'bg-destructive/20 text-destructive',
  };

  return (
    <Card className="shadow-card border-primary/20 overflow-hidden">
      <div className="h-1 gradient-primary" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
          {AI_NAME} — tahlil natijasi
          {analysis.grade && (
            <Badge className={`ml-auto text-lg px-3 ${gradeColor[analysis.grade] || 'bg-muted'}`}>
              {analysis.grade}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis.overall_assessment && (
          <p className="text-sm text-foreground leading-relaxed">{analysis.overall_assessment}</p>
        )}

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

        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" />Tavsiyalar
            </div>
            <ul className="space-y-1 pl-6">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc">{r}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.study_plan && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Award className="h-4 w-4 text-accent" />O'qish rejasi
            </div>
            <p className="text-sm text-muted-foreground">{analysis.study_plan}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
