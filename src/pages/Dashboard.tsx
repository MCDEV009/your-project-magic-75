import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, FileText, CheckCircle, Clock, Trophy, ArrowRight, 
  BarChart3, Calendar 
} from 'lucide-react';
import { format } from 'date-fns';

interface AttemptWithTest {
  id: string;
  test_id: string;
  status: string;
  score: number | null;
  total_questions: number | null;
  correct_answers: number | null;
  started_at: string;
  finished_at: string | null;
  mcq_score: number | null;
  written_score: number | null;
  tests: {
    title_uz: string;
    title_ru: string | null;
    title_en: string | null;
    duration_minutes: number;
  };
}

function DashboardContent() {
  const { t, language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AttemptWithTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    async function fetchAttempts() {
      // First get participant IDs for this user's email
      const { data: participants } = await supabase
        .from('test_participants')
        .select('participant_id')
        .eq('full_name', user!.user_metadata?.full_name || user!.email || '');

      if (!participants?.length) {
        setLoading(false);
        return;
      }

      const participantIds = participants.map(p => p.participant_id);

      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          id, test_id, status, score, total_questions, correct_answers,
          started_at, finished_at, mcq_score, written_score,
          tests (title_uz, title_ru, title_en, duration_minutes)
        `)
        .in('participant_id', participantIds)
        .order('started_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setAttempts(data as unknown as AttemptWithTest[]);
      }
      setLoading(false);
    }

    fetchAttempts();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  const finishedAttempts = attempts.filter(a => a.status === 'finished');
  const totalTests = finishedAttempts.length;
  const avgScore = totalTests > 0 
    ? Math.round(finishedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalTests) 
    : 0;
  const bestScore = totalTests > 0 
    ? Math.max(...finishedAttempts.map(a => a.score || 0)) 
    : 0;

  const getTestTitle = (test: AttemptWithTest['tests']) => {
    if (language === 'ru' && test.title_ru) return test.title_ru;
    if (language === 'en' && test.title_en) return test.title_en;
    return test.title_uz;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8">
        <div className="test-container space-y-8">
          {/* Welcome Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                Salom, {user.user_metadata?.full_name || user.email?.split('@')[0]} 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Sizning shaxsiy kabinet sahifangiz
              </p>
            </div>
            <Button 
              onClick={() => navigate('/tests')} 
              className="gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow gap-2"
            >
              Yangi test boshlash
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jami testlar</p>
                    <p className="text-2xl font-bold">{totalTests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">O'rtacha ball</p>
                    <p className="text-2xl font-bold">{avgScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Eng yuqori ball</p>
                    <p className="text-2xl font-bold">{bestScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <User className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium truncate max-w-[140px]">{user.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Attempts */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                So'nggi test natijalari
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : attempts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Hali test ishlanmagan</p>
                  <p className="text-sm mt-1">Testlarni boshlash uchun "Yangi test boshlash" tugmasini bosing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (attempt.status === 'finished') {
                          navigate(`/results/${attempt.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${
                          attempt.status === 'finished' ? 'bg-green-500/10' : 'bg-yellow-500/10'
                        }`}>
                          {attempt.status === 'finished' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {attempt.tests ? getTestTitle(attempt.tests) : 'Test'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(attempt.started_at), 'dd.MM.yyyy HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={attempt.status === 'finished' ? 'default' : 'secondary'}>
                          {attempt.status === 'finished' ? `${attempt.score || 0}%` : 'Jarayonda'}
                        </Badge>
                        {attempt.status === 'finished' && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <LanguageProvider>
      <DashboardContent />
    </LanguageProvider>
  );
}
