import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight, RefreshCw,
  Search, X, Loader2, CheckCircle2, XCircle, Clock as ClockIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Provider = 'payme' | 'click' | 'manual';
type TxnStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
type StatusFilter = 'all' | TxnStatus;

interface WalletRow { balance: number; currency: string }

interface TxnRow {
  id: string;
  amount: number;
  currency: string;
  provider: Provider;
  status: TxnStatus;
  type: string;
  created_at: string;
  paid_at: string | null;
}

const formatMoney = (n: number, currency = 'UZS') =>
  new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + ' ' + currency;

function statusVariant(status: TxnStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
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

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Top-up modal
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState<string>('50000');
  const [provider, setProvider] = useState<Provider>('payme');
  const [submitting, setSubmitting] = useState(false);
  const [pendingTxnId, setPendingTxnId] = useState<string | null>(null);
  const [pendingTxn, setPendingTxn] = useState<TxnRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setRefreshing(true);
    // RLS scopes both queries to auth.uid(); we additionally scope client-side
    // to defend against any client-side bypass.
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from('wallets').select('balance, currency').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions')
        .select('id, amount, currency, provider, status, type, created_at, paid_at, user_id')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    setWallet(w ?? { balance: 0, currency: 'UZS' });
    // Extra client-side guard: only show txns owned by current user
    const safe = ((t ?? []) as any[]).filter(row => row.user_id === user.id);
    setTxns(safe as TxnRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  // Real-time subscription to this user's transactions and wallet
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wallet_transactions',
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wallets',
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Poll the pending transaction every 4s for status update (fallback to realtime)
  useEffect(() => {
    if (!pendingTxnId) return;
    const tick = async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('id, amount, currency, provider, status, type, created_at, paid_at')
        .eq('id', pendingTxnId)
        .maybeSingle();
      if (data) setPendingTxn(data as TxnRow);
      if (data && (data.status === 'paid' || data.status === 'failed' || data.status === 'cancelled')) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pendingTxnId]);

  const handleTopUp = async () => {
    if (!user) return;
    const value = Number(amount);
    if (!value || value < 1000) {
      toast({ title: 'Noto\u2018g\u2018ri summa', description: 'Minimal summa 1 000 so\u2018m', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      amount: value,
      currency: 'UZS',
      provider,
      status: 'pending',
      type: 'topup',
      metadata: { source: 'wallet_page' },
    }).select('id, amount, currency, provider, status, type, created_at, paid_at').single();
    setSubmitting(false);
    if (error || !data) {
      toast({ title: 'Xatolik', description: error?.message ?? 'Tranzaksiya yaratilmadi', variant: 'destructive' });
      return;
    }
    setPendingTxnId(data.id);
    setPendingTxn(data as TxnRow);
    toast({ title: 'To\u2018lov yaratildi', description: 'Status real vaqtda yangilanadi.' });
    load();
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingTxnId(null);
    setPendingTxn(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Apply filters
  const filteredTxns = useMemo(() => {
    return txns.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!tx.id.toLowerCase().includes(q) && !tx.type.toLowerCase().includes(q) && !tx.provider.toLowerCase().includes(q)) return false;
      }
      if (dateFrom && new Date(tx.created_at).getTime() < new Date(dateFrom).getTime()) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(tx.created_at).getTime() > end.getTime()) return false;
      }
      return true;
    });
  }, [txns, statusFilter, search, dateFrom, dateTo]);

  const resetFilters = () => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); };
  const hasActiveFilters = !!(search || statusFilter !== 'all' || dateFrom || dateTo);

  const renderStatusBadge = (status: TxnStatus) => {
    const Icon = status === 'paid' ? CheckCircle2 : status === 'pending' ? Loader2 : XCircle;
    return (
      <Badge variant={statusVariant(status)} className="gap-1 capitalize">
        <Icon className={`h-3 w-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Hamyon — Milliy Sertifikat</title></Helmet>
      <Header />
      <main className="test-container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hamyon</h1>
            <p className="text-muted-foreground">Balans va to'lovlar tarixi</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

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
            <Button size="lg" variant="secondary" className="gap-2" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Balansni to'ldirish
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <CardTitle>Tranzaksiyalar tarixi ({filteredTxns.length})</CardTitle>
              <div className="grid gap-2 md:grid-cols-5">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="ID, tur yoki provayder..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Boshlanish sanasi" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Tugash sanasi" />
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
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredTxns.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                {txns.length === 0 ? "Hozircha tranzaksiyalar yo'q" : "Filtrlar bo'yicha hech narsa topilmadi"}
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
                    {filteredTxns.map((tx) => {
                      const isIn = tx.type === 'topup' || tx.type === 'refund';
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(tx.created_at), 'dd.MM.yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              {isIn
                                ? <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                                : <ArrowUpRight className="h-4 w-4 text-orange-500" />}
                              <span className="capitalize">{tx.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{tx.provider}</TableCell>
                          <TableCell className={`text-right font-semibold ${isIn ? 'text-emerald-600' : ''}`}>
                            {isIn ? '+' : '-'} {formatMoney(tx.amount, tx.currency)}
                          </TableCell>
                          <TableCell>{renderStatusBadge(tx.status)}</TableCell>
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

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); else setModalOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Balansni to'ldirish</DialogTitle>
            <DialogDescription>
              To'lov provayderini tanlang va summani kiriting. Status real vaqtda yangilanadi.
            </DialogDescription>
          </DialogHeader>

          {!pendingTxn ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Summa (UZS)</Label>
                <Input id="amount" type="number" min={1000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  {[25000, 50000, 100000, 250000].map((v) => (
                    <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(String(v))}>
                      {formatMoney(v)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>To'lov usuli</Label>
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
                        {p === 'payme' ? 'Payme orqali to\u2018lov' : 'Click orqali to\u2018lov'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                {pendingTxn.status === 'pending' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                {pendingTxn.status === 'paid' && <CheckCircle2 className="h-8 w-8 text-emerald-500" />}
                {(pendingTxn.status === 'failed' || pendingTxn.status === 'cancelled') && <XCircle className="h-8 w-8 text-destructive" />}
                <div className="flex-1">
                  <div className="font-semibold">
                    {pendingTxn.status === 'pending' && "Tasdiqlanishi kutilmoqda..."}
                    {pendingTxn.status === 'paid' && "To'lov muvaffaqiyatli amalga oshirildi"}
                    {pendingTxn.status === 'failed' && "To'lov amalga oshmadi"}
                    {pendingTxn.status === 'cancelled' && "To'lov bekor qilindi"}
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {pendingTxn.provider} • {formatMoney(pendingTxn.amount, pendingTxn.currency)}
                  </div>
                </div>
                {renderStatusBadge(pendingTxn.status)}
              </div>
              {pendingTxn.status === 'pending' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ClockIcon className="h-3 w-3" />
                  Webhook orqali tasdiqlangach balans avtomatik yangilanadi.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {!pendingTxn ? (
              <>
                <Button variant="outline" onClick={closeModal} disabled={submitting}>Bekor qilish</Button>
                <Button onClick={handleTopUp} disabled={submitting}>
                  {submitting ? 'Yaratilmoqda…' : "To'lov yaratish"}
                </Button>
              </>
            ) : (
              <Button onClick={closeModal} variant={pendingTxn.status === 'paid' ? 'default' : 'outline'}>
                {pendingTxn.status === 'paid' ? 'Yopish' : 'Yopish'}
              </Button>
            )}
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