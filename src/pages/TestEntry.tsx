import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Test } from '@/types/test';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExamRulesModal } from '@/components/test/ExamRulesModal';
import { ArrowRight, User, Clock, FileQuestion, Copy, CheckCircle, Award, CalendarClock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradeModal } from '@/components/UpgradeModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet as WalletIcon, Coins, Loader2 } from 'lucide-react';

function generateParticipantId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function TestEntryContent() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { plan, remaining, canUse, increment } = useUsageLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);
  
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [participantId] = useState(generateParticipantId());
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [priceUzs, setPriceUzs] = useState<number | null>(null);
  const [isFreePricing, setIsFreePricing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    async function fetchTest() {
      // Check if testId is a UUID or a 5-digit code
      let query = supabase.from('tests').select('*, subjects(*)');
      
      if (testId?.length === 5 && /^\d{5}$/.test(testId)) {
        query = query.eq('test_code', testId);
      } else {
        query = query.eq('id', testId);
      }
      
      const { data, error } = await query.single();
      
      if (!error && data) {
        setTest(data as Test);
        
        // Get question count
        const { data: qData } = await supabase
          .rpc('get_public_questions', { p_test_id: data.id });
        const count = qData?.length || 0;
        setQuestionCount(count || 0);

        // Pricing
        const { data: pricing } = await supabase
          .from('test_pricing')
          .select('price_uzs, is_free')
          .eq('test_id', data.id)
          .maybeSingle();
        if (pricing) {
          setPriceUzs(Number(pricing.price_uzs));
          setIsFreePricing(!!pricing.is_free);
        }
      }
      setLoading(false);
    }

    fetchTest();
  }, [testId]);

  // Load wallet + purchase status when user/test known
  useEffect(() => {
    async function loadPaymentState() {
      if (!user || !test) return;
      const [{ data: wallet }, { data: purchase }] = await Promise.all([
        supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('test_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('test_id', test.id)
          .maybeSingle(),
      ]);
      setWalletBalance(wallet ? Number(wallet.balance) : 0);
      setPurchased(!!purchase);
    }
    loadPaymentState();
  }, [user?.id, test?.id]);

  // Update clock every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(participantId);
    setCopied(true);
    toast.success("ID nusxalandi!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Scheduled test logic
  const scheduledStart = test?.scheduled_start ? new Date(test.scheduled_start).getTime() : null;
  const registrationDeadline = scheduledStart ? scheduledStart - 30 * 60 * 1000 : null;
  const isRegistrationClosed = registrationDeadline ? now > registrationDeadline : false;
  const isTestNotStarted = scheduledStart ? now < scheduledStart : false;
  const testEndTime = scheduledStart && test ? scheduledStart + test.duration_minutes * 60 * 1000 : null;
  const isTestFinished = testEndTime ? now > testEndTime : false;
  const timeUntilStart = scheduledStart ? Math.max(0, Math.floor((scheduledStart - now) / 1000)) : 0;

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleProceed = () => {
    if (!fullName.trim()) {
      toast.error(t('enterFullName'));
      return;
    }
    // Free plan limit check (only for logged-in users; anonymous bypass for now)
    if (user && plan === 'free' && !canUse('mocks')) {
      setShowUpgrade(true);
      return;
    }
    // Paid test handling — pay via wallet balance
    if ((test?.visibility as string) === 'paid' && !isFreePricing && plan !== 'premium' && !purchased) {
      if (!user) {
        toast.info('Pullik testga kirish uchun tizimga kiring.');
        navigate('/auth');
        return;
      }
      setShowPayModal(true);
      return;
    }
    if (isRegistrationClosed && isTestNotStarted) {
      toast.error("Ro'yxatdan o'tish vaqti tugagan! Testga 30 daqiqa oldin ro'yxatdan o'tish kerak edi.");
      return;
    }
    if (isTestNotStarted) {
      // Allow registration but show rules, test will start at scheduled time
      setShowRulesModal(true);
      return;
    }
    setShowRulesModal(true);
  };

  const effectivePrice = priceUzs ?? 10000;
  const formatPrice = (n: number) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm";

  const handlePayWithWallet = async () => {
    if (!test) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.rpc('purchase_test_with_wallet', { _test_id: test.id });
      if (error) {
        if (error.message?.includes('insufficient_balance')) {
          toast.error("Balansda mablag' yetarli emas. Iltimos, balansni to'ldiring.");
          setShowPayModal(false);
          navigate('/wallet');
          return;
        }
        throw error;
      }
      setPurchased(true);
      // refresh wallet
      const { data: wallet } = await supabase
        .from('wallets').select('balance').eq('user_id', user!.id).maybeSingle();
      setWalletBalance(wallet ? Number(wallet.balance) : 0);
      toast.success("To'lov muvaffaqiyatli amalga oshirildi!");
      setShowPayModal(false);
      setShowRulesModal(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t('error'));
    } finally {
      setPaying(false);
    }
  };

  const handleStartTest = async () => {
    if (!fullName.trim() || !test) return;
    
    setSubmitting(true);
    
    try {
      // Create participant
      const { error: participantError } = await supabase
        .from('test_participants')
        .insert({
          participant_id: participantId,
          full_name: fullName.trim(),
          user_id: user?.id ?? null,
        });
      
      if (participantError) throw participantError;
      
      // Create test attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .insert({
          test_id: test.id,
          participant_id: participantId,
          total_questions: questionCount,
          status: 'in_progress'
        })
        .select()
        .single();
      
      if (attemptError) throw attemptError;
      
      // Track usage for free plan
      if (user) { try { await increment('mocks_taken'); } catch {} }

      // Navigate to test
      navigate(`/test/${attempt.id}`, { 
        state: { 
          participantId,
          fullName: fullName.trim()
        }
      });
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const title = test ? (
    language === 'ru' && test.title_ru ? test.title_ru :
    language === 'en' && test.title_en ? test.title_en : test.title_uz
  ) : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4 shadow-card">
            <CardContent className="pt-6 text-center">
              <p className="text-destructive mb-4">{t('testNotFound')}</p>
              <Button onClick={() => navigate('/')}>{t('backToHome')}</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-elevated animate-scale-in">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              {test.test_format === 'milliy_sertifikat' && (
                <Badge variant="default" className="gap-1">
                  <Award className="h-3 w-3" />
                  Milliy Sertifikat
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="flex items-center justify-center gap-4 mt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {test.duration_minutes} {t('minutes')}
              </span>
              <span className="flex items-center gap-1">
                <FileQuestion className="h-4 w-4" />
                {questionCount} {t('questions')}
              </span>
            </CardDescription>
            {test.test_format === 'milliy_sertifikat' && (
              <p className="text-xs text-muted-foreground mt-2">
                1-35: Test savollari (1 ball) • 36-45: Yozma savollar (0-2 ball)
              </p>
            )}
            {scheduledStart && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <Badge variant="outline" className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {new Date(scheduledStart).toLocaleString('uz-UZ', { 
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </Badge>
                {isTestFinished && (
                  <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Test yakunlangan
                  </div>
                )}
                {isTestNotStarted && !isTestFinished && (
                   <div className="text-center mt-2">
                     <p className="text-sm font-mono font-bold text-primary">{formatCountdown(timeUntilStart)}</p>
                     <p className="text-xs text-muted-foreground">boshlanishigacha</p>
                   </div>
                )}
                {isRegistrationClosed && isTestNotStarted && !isTestFinished && (
                  <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Ro'yxatdan o'tish vaqti tugagan
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('fullName')}
              </Label>
              <Input
                id="fullName"
                placeholder={t('enterFullName')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleProceed()}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('yourId')}
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-2.5 bg-muted rounded-lg font-mono text-lg tracking-wider text-center select-all">
                  {participantId}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleCopyId}
                  className="shrink-0"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Bu IDni saqlang - natijalaringizni ko'rish uchun kerak bo'ladi
              </p>
            </div>

            <Button
              onClick={handleProceed}
              disabled={!fullName.trim() || submitting || isTestFinished || (isRegistrationClosed && isTestNotStarted)}
              className="w-full h-12 text-lg gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"
            >
              {submitting ? t('loading') : isTestFinished ? "Test yakunlangan" : isTestNotStarted ? "Ro'yxatdan o'tish" : t('startTest')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </main>

      <ExamRulesModal
        open={showRulesModal}
        onAccept={handleStartTest}
        testTitle={title}
        duration={test.duration_minutes}
        questionCount={questionCount}
        isMilliySertifikat={test.test_format === 'milliy_sertifikat'}
      />
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        reason={`Free tarifda oyiga 5 ta mock test mumkin. Joriy oy uchun limit tugadi (qoldi: ${Math.max(0, remaining.mocks)}).`}
      />

      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              Pullik testga kirish
            </DialogTitle>
            <DialogDescription>
              Bu test pullik. Balansdan to'lov yechib olinadi va testga kirish ochiladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Test narxi</span>
              <span className="font-semibold">{formatPrice(effectivePrice)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <WalletIcon className="h-4 w-4" /> Balans
              </span>
              <span className={`font-semibold ${walletBalance < effectivePrice ? 'text-destructive' : ''}`}>
                {formatPrice(walletBalance)}
              </span>
            </div>
            {walletBalance < effectivePrice && (
              <p className="text-xs text-destructive">
                Balansda mablag' yetarli emas. Iltimos, avval balansni to'ldiring.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setShowPayModal(false); navigate('/wallet'); }}>
              Balansni to'ldirish
            </Button>
            <Button
              onClick={handlePayWithWallet}
              disabled={paying || walletBalance < effectivePrice}
              className="gradient-primary border-0"
            >
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              To'lash va boshlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TestEntry() {
  return (
    <LanguageProvider>
      <TestEntryContent />
    </LanguageProvider>
  );
}
