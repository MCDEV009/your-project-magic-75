import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { bmbaGrade, type BmbaGradeInfo } from '@/lib/rasch';

export interface LastAttempt {
  id: string;
  test_id: string;
  score: number | null;
  total_questions: number | null;
  correct_answers: number | null;
  submitted_at: string | null;
  title: string | null;
}

interface State {
  attempt: LastAttempt | null;
  pct: number | null;
  gradeInfo: BmbaGradeInfo | null;
  loading: boolean;
}

const EMPTY: State = { attempt: null, pct: null, gradeInfo: null, loading: false };

export function useLastAttempt(): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    if (!user) { setState(EMPTY); return; }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    (async () => {
      try {
        const { data: parts } = await supabase
          .from('test_participants').select('participant_id').eq('user_id', user.id);
        const ids = (parts ?? []).map((p) => p.participant_id);
        if (!ids.length) { if (!cancelled) setState(EMPTY); return; }

        // The table stores the submission time in finished_at.
        const { data: row } = await supabase
          .from('test_attempts')
          .select('id, test_id, score, total_questions, correct_answers, finished_at, mcq_score, written_score, tests(title_uz)')
          .in('participant_id', ids)
          .eq('status', 'finished')
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!row) { if (!cancelled) setState(EMPTY); return; }

        // Same formula as src/pages/Results.tsx
        const { data: qs } = await supabase.rpc('get_public_questions', { p_test_id: row.test_id });
        const questions = qs ?? [];
        const totalMcqPoints = questions.filter((q) => q.question_type === 'single_choice').reduce((s, q) => s + (q.points || 1), 0);
        const totalWrittenPoints = questions.filter((q) => q.question_type === 'written').reduce((s, q) => s + (q.max_points || 3.2), 0);
        const totalScore = (row.mcq_score || 0) + (row.written_score || 0);
        const totalPoints = totalMcqPoints + totalWrittenPoints;
        const pct = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;

        const test = row.tests as { title_uz?: string } | null;
        if (!cancelled) setState({
          attempt: {
            id: row.id, test_id: row.test_id, score: row.score,
            total_questions: row.total_questions, correct_answers: row.correct_answers,
            submitted_at: row.finished_at, title: test?.title_uz ?? null,
          },
          pct, gradeInfo: bmbaGrade(pct), loading: false,
        });
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return state;
}
