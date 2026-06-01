import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LanguageProvider } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Provider = 'payme' | 'click' | 'manual';

interface WalletRow {
  balance: number;
  currency: string;
}

interface TxnRow {
  id: string;
  amount: number;
  currency: string;
  provider: Provider;
  status: string;
  type: string;
  created_at: string;
  paid_at: string | null;
}

const formatMoney = (n: number, currency = 'UZS') =>
  new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + ' ' + currency;

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid': return 'default';
    case 'pending': return 'secondary';
    case 'failed':
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
}

function WalletContent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState<string>('50000');
  const [provider, setProvider] = useState<Provider>('payme');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setRefreshing(true);
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from('wallets').select('balance, currency').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions')
        .select('id, amount, currency, provider, status, type, created_at, paid_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setWallet(w ?? { balance: 0, currency: 'UZS' });
    setTxns((t ?? []) as TxnRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  const handleTopUp = async () => {
    if (!user) return;
    const value = Number(amount);
    if (!value || value < 1000) {
      toast({ title: 'Noto‘g‘ri summa', description: 'Minimal summa 1 000 so‘m', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      amount: value,
      currency: 'UZS',
      provider,
      status: 'pending',
      type: 'topup',
      metadata: { source: 'wallet_page' },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'To‘lov yaratildi',
      description: 'To‘lov tasdiqlangach hisobingiz to‘ldiriladi.',
    });
    setModalOpen(false);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Hamyon — Milliy Sertifikat</title></Helmet>
      <Header />
      <main className="test-container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hamyon</h1>
            <p className="text-muted-foreground">Balans va to‘lovlar tarixi</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="overflow-hidden border-0 shadow-soft gradient-primary text-primary-foreground">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                <WalletIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm opacity-80">Joriy balans</div>
                {loading ? (
                  <Skeleton className="h-9 w-40 bg-white/20" />
                ) : (
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                    {formatMoney(wallet?.balance ?? 0, wallet?.currency ?? 'UZS')}
                  </div>
                )}
              </div>
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Balansni to‘ldirish
            </Button>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Tranzaksiyalar tarixi</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : txns.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Hozircha tranzaksiyalar yo‘q
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead>Provayder</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Holati</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txns.map((tx) => {
                      const isIn = tx.type === 'topup' || tx.type === 'refund';
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(tx.created_at), 'dd.MM.yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              {isIn ? (
                                <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-orange-500" />
                              )}
                              <span className="capitalize">{tx.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{tx.provider}</TableCell>
                          <TableCell className={`text-right font-semibold ${isIn ? 'text-emerald-600' : ''}`}>
                            {isIn ? '+' : '-'} {formatMoney(tx.amount, tx.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(tx.status)} className="capitalize">{tx.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Top-up Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Balansni to‘ldirish</DialogTitle>
            <DialogDescription>
              To‘lov provayderini tanlang va summani kiriting. Tasdiqlangach balans yangilanadi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Summa (UZS)</Label>
              <Input
                id="amount"
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                {[25000, 50000, 100000, 250000].map((v) => (
                  <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(String(v))}>
                    {formatMoney(v)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>To‘lov usuli</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['payme', 'click'] as Provider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      provider === p ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium capitalize">{p}</div>
                    <div className="text-xs text-muted-foreground">
                      {p === 'payme' ? 'Payme orqali to‘lov' : 'Click orqali to‘lov'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Bekor qilish
            </Button>
            <Button onClick={handleTopUp} disabled={submitting}>
              {submitting ? 'Yaratilmoqda…' : 'To‘lov yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Wallet() {
  return (
    <LanguageProvider>
      <WalletContent />
    </LanguageProvider>
  );
}