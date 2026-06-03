import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  User, FileText, CheckCircle, Clock, Trophy, ArrowRight,
  BarChart3, Calendar, Search, Download, RotateCcw, Wallet as WalletIcon,
  X, Coins,
} from 'lucide-react';
import { format } from 'date-fns';
import { exportAttemptSummaryPdf } from '@/lib/attemptPdfExport';
import { toast } from 'sonner';

interface AttemptWithTest {
  id: string;
  test_id: string;
  participant_id: string;
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
    visibility: string;
    test_format: string | null;
  };
}

interface PurchaseRow {
  test_id: string;
  amount: number;
  created_at: string;
}

type StatusFilter = 'all' | 'finished' | 'in_progress';
type FormatFilter = 'all' | 'standard' | 'milliy_sertifikat';

function DashboardContent() {
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AttemptWithTest[]>([]);
  const [purchases, setPurchases] = useState<Record<string, PurchaseRow>>({});
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    async function fetchAttempts() {
      // Resolve participant IDs via two robust queries (avoid .or() parsing edge cases)
      const legacyName = user!.user_metadata?.full_name || user!.email || '';
      const [byId, byName] = await Promise.all([
        supabase.from('test_participants').select('participant_id, full_name').eq('user_id', user!.id),
        legacyName
          ? supabase.from('test_participants').select('participant_id, full_name').eq('full_name', legacyName)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const participants = [...((byId as any).data ?? []), ...((byName as any).data ?? [])];

      if (!participants.length) {
        setAttempts([]);
        setLoading(false);
        return;
      }

      const participantIds = Array.from(new Set(participants.map((p: any) => p.participant_id)));
      const nameMap: Record<string, string> = {};
      for (const p of participants as any[]) nameMap[p.participant_id] = p.full_name;
      setParticipantNames(nameMap);

      const [attemptsRes, walletRes] = await Promise.all([
        supabase
          .from('test_attempts')
          .select(`
            id, test_id, participant_id, status, score, total_questions, correct_answers,
            started_at, finished_at, mcq_score, written_score,
            tests (title_uz, title_ru, title_en, duration_minutes, visibility, test_format)
          `)
          .in('participant_id', participantIds)
          .order('started_at', { ascending: false })
          .limit(100),
        supabase.from('wallets').select('balance').eq('user_id', user!.id).maybeSingle(),
      ]);

      if (!attemptsRes.error && attemptsRes.data) {
        const data = attemptsRes.data as unknown as AttemptWithTest[];
        setAttempts(data);
        const paidTestIds = Array.from(new Set(
          data.filter(a => a.tests?.visibility === 'paid').map(a => a.test_id)
        ));
        if (paidTestIds.length) {
          const { data: pdata } = await supabase
            .from('test_purchases')
            .select('test_id, amount, created_at')
            .eq('user_id', user!.id)
            .in('test_id', paidTestIds);
          const map: Record<string, PurchaseRow> = {};
          for (const p of (pdata ?? [])) map[p.test_id] = p as PurchaseRow;
          setPurchases(map);
        }
      }
      setWalletBalance(walletRes.data ? Number(walletRes.data.balance) : 0);
      setLoading(false);
    }

    fetchAttempts();
  }, [user]);

  const getTestTitle = (test: AttemptWithTest['tests']) => {
    if (!test) return 'Test';
    if (language === 'ru' && test.title_ru) return test.title_ru;
    if (language === 'en' && test.title_en) return test.title_en;
    return test.title_uz;
  };

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (formatFilter !== 'all' && (a.tests?.test_format ?? 'standard') !== formatFilter) return false;
      if (search.trim()) {
        const title = a.tests ? getTestTitle(a.tests).toLowerCase() : '';
        if (!title.includes(search.trim().toLowerCase())) return false;
      }
      if (dateFrom && new Date(a.started_at).getTime() < new Date(dateFrom).getTime()) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(a.started_at).getTime() > end.getTime()) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, statusFilter, formatFilter, search, dateFrom, dateTo, language]);

  const resetFilters = () => {
    setSearch(''); setStatusFilter('all'); setFormatFilter('all'); setDateFrom(''); setDateTo('');
  };

  const handleRetest = (attempt: AttemptWithTest) => {
    const isPaid = attempt.tests?.visibility === 'paid';
    const purchased = !!purchases[attempt.test_id];
    if (isPaid && !purchased && walletBalance < 10000) {
      toast.error("Qayta topshirish uchun balansda mablag' yetarli emas.");
      navigate('/wallet');
      return;
    }
    navigate(`/test/${attempt.test_id}`);
  };

  const handleExportPdf = (attempt: AttemptWithTest) => {
    try {
      const purchase = purchases[attempt.test_id];
      exportAttemptSummaryPdf({
        participantName: participantNames[attempt.participant_id] || (user?.user_metadata?.full_name || user?.email || ''),
        participantId: attempt.participant_id,
        testTitle: getTestTitle(attempt.tests),
        status: attempt.status,
        startedAt: new Date(attempt.started_at),
        finishedAt: attempt.finished_at ? new Date(attempt.finished_at) : null,
        score: Number(attempt.score ?? 0),
        mcqScore: Number(attempt.mcq_score ?? 0),
        writtenScore: Number(attempt.written_score ?? 0),
        totalQuestions: Number(attempt.total_questions ?? 0),
        correctAnswers: Number(attempt.correct_answers ?? 0),
        durationMinutes: attempt.tests?.duration_minutes ?? 0,
        testFormat: attempt.tests?.test_format ?? undefined,
        paid: !!purchase && Number(purchase.amount) > 0,
        paidAmount: purchase ? Number(purchase.amount) : undefined,
        paidAt: purchase ? new Date(purchase.created_at) : null,
      });
    } catch (e) {
      toast.error('PDF yaratishda xatolik');
      console.error(e);
    }
  };

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
  const bestScore = totalTests > 0 ? Math.max(...finishedAttempts.map(a => a.score || 0)) : 0;

  const hasActiveFilters = !!(search || statusFilter !== 'all' || formatFilter !== 'all' || dateFrom || dateTo);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Mening panelim — Milliy Sertifikat</title>
        <meta name="description" content="Mock test natijalaringizni, statistikangizni va o'tilgan imtihonlar tarixini bir joyda ko'ring." />
        <link rel="canonical" href="https://msmocktest.lovable.app/dashboard" />
      </Helmet>
      <Header />
      <main className="flex-1 py-8">
        <div className="test-container space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                Salom, {user.user_metadata?.full_name || user.email?.split('@')[0]} 👋
              </h1>
              <p className="text-muted-foreground mt-1">Sizning shaxsiy kabinet sahifangiz</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/wallet')} className="gap-2">
                <WalletIcon className="h-4 w-4" />
                Hamyon
              </Button>
              <Button onClick={() => navigate('/tests')} className="gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow gap-2">
                Yangi test boshlash
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
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
                  <div className="p-2 rounded-lg bg-green-500/10"><BarChart3 className="h-5 w-5 text-green-500" /></div>
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
                  <div className="p-2 rounded-lg bg-yellow-500/10"><Trophy className="h-5 w-5 text-yellow-500" /></div>
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
                  <div className="p-2 rounded-lg bg-blue-500/10"><User className="h-5 w-5 text-blue-500" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium truncate max-w-[140px]">{user.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Test natijalari ({filteredAttempts.length})
                </CardTitle>
                <div className="grid gap-2 md:grid-cols-6">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Test nomi bo'yicha qidirish..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha status</SelectItem>
                      <SelectItem value="finished">Yakunlangan</SelectItem>
                      <SelectItem value="in_progress">Jarayonda</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={formatFilter} onValueChange={(v) => setFormatFilter(v as FormatFilter)}>
                    <SelectTrigger><SelectValue placeholder="Test turi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha turlar</SelectItem>
                      <SelectItem value="standard">Standart</SelectItem>
                      <SelectItem value="milliy_sertifikat">Milliy Sertifikat</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Boshlanish sanasi"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Tugash sanasi"
                  />
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="self-start gap-1.5">
                    <X className="h-4 w-4" /> Filtrlarni tozalash
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : attempts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Hali test ishlanmagan</p>
                  <p className="text-sm mt-1">Testlarni boshlash uchun "Yangi test boshlash" tugmasini bosing</p>
                </div>
              ) : filteredAttempts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Filtrlar bo'yicha hech narsa topilmadi</p>
                  <Button variant="link" onClick={resetFilters} className="mt-1">Filtrlarni tozalash</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAttempts.map((attempt) => {
                    const pct = Math.max(0, Math.min(100, Math.round(attempt.score || 0)));
                    const isPaid = attempt.tests?.visibility === 'paid';
                    const purchase = purchases[attempt.test_id];
                    const purchased = !!purchase;
                    return (
                      <div key={attempt.id} className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-lg shrink-0 ${attempt.status === 'finished' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                              {attempt.status === 'finished'
                                ? <CheckCircle className="h-4 w-4 text-green-500" />
                                : <Clock className="h-4 w-4 text-yellow-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{getTestTitle(attempt.tests)}</p>
                                {attempt.tests?.test_format === 'milliy_sertifikat' && (
                                  <Badge variant="outline" className="text-[10px] gap-1">
                                    <Trophy className="h-3 w-3" /> Milliy
                                  </Badge>
                                )}
                                {isPaid && (purchased ? (
                                  <Badge className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/20 border">
                                    <Coins className="h-3 w-3" /> To'langan
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px] gap-1">
                                    <Coins className="h-3 w-3" /> Balans yetmagan
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Boshl.: {format(new Date(attempt.started_at), 'dd.MM.yyyy HH:mm')}
                                </span>
                                {attempt.finished_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Yakuni: {format(new Date(attempt.finished_at), 'dd.MM.yyyy HH:mm')}
                                  </span>
                                )}
                                {purchased && (
                                  <span className="flex items-center gap-1">
                                    <WalletIcon className="h-3 w-3" />
                                    To'lov: {format(new Date(purchase.created_at), 'dd.MM.yyyy HH:mm')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant={attempt.status === 'finished' ? 'default' : 'secondary'} className="shrink-0">
                            {attempt.status === 'finished' ? `${pct}%` : 'Jarayonda'}
                          </Badge>
                        </div>

                        {attempt.status === 'finished' && (
                          <div className="space-y-1">
                            <Progress value={pct} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>MCQ: {Math.round(attempt.mcq_score || 0)}</span>
                              <span>Yozma: {Math.round(attempt.written_score || 0)}</span>
                              <span>Jami: {pct}%</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {attempt.status === 'finished' ? (
                            <>
                              <Button size="sm" onClick={() => navigate(`/results/${attempt.id}`)} className="gap-1.5">
                                Natijani ko'rish <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleExportPdf(attempt)} className="gap-1.5">
                                <Download className="h-3.5 w-3.5" /> PDF
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => navigate(`/test/${attempt.id}`)} className="gap-1.5">
                              Davom ettirish <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleRetest(attempt)} className="gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" /> Qayta topshirish
                            {isPaid && !purchased && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">Pullik</Badge>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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