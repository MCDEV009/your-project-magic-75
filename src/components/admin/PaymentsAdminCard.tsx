import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw, CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface AdminTxn {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  amount: number;
  currency: string;
  provider: string;
  provider_txn_id: string | null;
  status: string;
  type: string;
  metadata: any;
  paid_at: string | null;
  created_at: string;
}

const STATUS_FILTERS = [
  { key: 'pending', label: 'Kutilmoqda' },
  { key: 'paid', label: 'Tasdiqlangan' },
  { key: 'cancelled', label: 'Rad etilgan' },
  { key: 'all', label: 'Barchasi' },
] as const;

const statusBadge = (s: string) => {
  if (s === 'paid') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Tasdiqlangan</Badge>;
  if (s === 'pending') return <Badge variant="outline">Kutilmoqda</Badge>;
  if (s === 'refunded') return <Badge variant="secondary">Qaytarilgan</Badge>;
  return <Badge variant="destructive">Rad etilgan</Badge>;
};

const money = (n: number) => new Intl.NumberFormat('uz-UZ').format(Number(n || 0));

export function PaymentsAdminCard() {
  const [filter, setFilter] = useState<string>('pending');
  const [txns, setTxns] = useState<AdminTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // payment settings
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('admin_wallet_transactions', {
      _status: filter === 'all' ? null : filter,
      _limit: 200,
    });
    if (error) toast.error(error.message);
    setTxns((data ?? []) as AdminTxn[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('payment_settings').select('*').maybeSingle();
      if (data) {
        setCardNumber(data.card_number ?? '');
        setCardHolder(data.card_holder ?? '');
        setBankName(data.bank_name ?? '');
        setInstructions(data.instructions ?? '');
      }
    })();
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('admin-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const approve = async (t: AdminTxn) => {
    setBusyId(t.id);
    const { error } = await (supabase as any).rpc('credit_wallet_for_transaction', {
      _txn_id: t.id,
      _provider_txn_id: t.provider_txn_id,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`${money(t.amount)} so'm balansga qo'shildi`);
    load();
  };

  const reject = async (t: AdminTxn) => {
    const reason = window.prompt('Rad etish sababi (ixtiyoriy):') ?? undefined;
    setBusyId(t.id);
    const { error } = await (supabase as any).rpc('cancel_wallet_transaction', {
      _txn_id: t.id,
      _reason: reason || 'Admin tomonidan rad etildi',
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("To'lov rad etildi");
    load();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from('payment_settings').upsert({
      id: true,
      card_number: cardNumber,
      card_holder: cardHolder,
      bank_name: bankName,
      instructions,
      updated_at: new Date().toISOString(),
    } as any);
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success('Karta rekvizitlari saqlandi');
  };

  const pendingCount = txns.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> To'lovlarni tasdiqlash
          {filter === 'pending' && pendingCount > 0 && (
            <Badge className="ml-1">{pendingCount}</Badge>
          )}
        </h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Yangilash
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tranzaksiyalar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!loading && txns.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Bu bo'limda tranzaksiya yo'q</p>
          )}
          {!loading && txns.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {t.full_name || t.username || t.email || t.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{money(t.amount)} {t.currency}</p>
                  <div className="flex items-center gap-2 justify-end mt-1">
                    <Badge variant="secondary" className="uppercase">{t.provider}</Badge>
                    {statusBadge(t.status)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{new Date(t.created_at).toLocaleString('uz-UZ')}</p>
                {t.provider_txn_id && <p>Chek / ID: <span className="font-mono">{t.provider_txn_id}</span></p>}
                {t.metadata?.payer_note && <p>Izoh: {t.metadata.payer_note}</p>}
                {t.metadata?.cancel_reason && <p>Rad sababi: {t.metadata.cancel_reason}</p>}
              </div>

              {t.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => approve(t)} disabled={busyId === t.id}>
                    {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Tasdiqlash
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => reject(t)} disabled={busyId === t.id}>
                    <XCircle className="h-4 w-4 mr-1" /> Rad etish
                  </Button>
                </div>
              )}
              {t.status === 'paid' && (
                <Button size="sm" variant="outline" onClick={() => reject(t)} disabled={busyId === t.id}>
                  Bekor qilish / qaytarish
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Karta rekvizitlari
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Karta raqami</Label>
            <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="9860 1666 5600 5377" />
          </div>
          <div>
            <Label>Karta egasi</Label>
            <Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} />
          </div>
          <div>
            <Label>Bank</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Ko'rsatma (foydalanuvchiga ko'rinadi)</Label>
            <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
