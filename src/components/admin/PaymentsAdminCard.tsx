import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Settings {
  card_number: string;
  card_holder: string;
  bank_name: string;
  instructions: string;
}

interface PendingTxn {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  provider: string;
  created_at: string;
  metadata: any;
}

interface ErrorRow {
  id: string;
  source: string;
  attempt_id: string | null;
  sqlstate: string | null;
  message: string | null;
  created_at: string;
}

export function PaymentsAdminCard() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>({ card_number: '', card_holder: '', bank_name: '', instructions: '' });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingTxn[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: e }] = await Promise.all([
      supabase.from('payment_settings').select('card_number, card_holder, bank_name, instructions').maybeSingle(),
      supabase.from('wallet_transactions')
        .select('id, user_id, amount, currency, provider, created_at, metadata')
        .eq('status', 'pending').eq('type', 'topup')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('trigger_error_log')
        .select('id, source, attempt_id, sqlstate, message, created_at')
        .order('created_at', { ascending: false }).limit(20),
    ]);
    if (s) setSettings(s as Settings);
    setPending((p ?? []) as PendingTxn[]);
    setErrors((e ?? []) as ErrorRow[]);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('payment_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', true);
    setSaving(false);
    toast(error
      ? { title: 'Xatolik', description: error.message, variant: 'destructive' }
      : { title: 'Saqlandi', description: 'Karta ma\u2018lumotlari yangilandi' });
  };

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    const { error } = approve
      ? await supabase.rpc('credit_wallet_for_transaction', { _txn_id: id })
      : await supabase.rpc('cancel_wallet_transaction', { _txn_id: id, _reason: 'admin_rejected' });
    setBusyId(null);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: approve ? 'Tasdiqlandi' : 'Bekor qilindi' });
    load();
  };

  const money = (n: number, c = 'UZS') => new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + ' ' + c;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Karta orqali to'lov sozlamalari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Karta raqami</Label>
              <Input value={settings.card_number} onChange={(e) => setSettings({ ...settings, card_number: e.target.value })} placeholder="8600 1234 5678 9012" />
            </div>
            <div className="space-y-2">
              <Label>Karta egasi</Label>
              <Input value={settings.card_holder} onChange={(e) => setSettings({ ...settings, card_holder: e.target.value })} placeholder="ISM FAMILIYA" />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Input value={settings.bank_name} onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} placeholder="Uzcard / Humo" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ko'rsatma</Label>
              <Textarea rows={3} value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
                placeholder="To'lovdan so'ng chekni Telegram orqali yuboring..." />
            </div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saqlanmoqda…' : 'Saqlash'}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Tasdiqlanmagan to'lovlar ({pending.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Kutilayotgan to'lovlar yo'q</p>
          ) : pending.map((tx) => (
            <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{money(tx.amount, tx.currency)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {format(new Date(tx.created_at), 'dd.MM.yyyy HH:mm')} • <span className="capitalize">{tx.provider}</span>
                  {tx.metadata?.payer_note ? ` • ${tx.metadata.payer_note}` : ''}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">{tx.user_id}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === tx.id} onClick={() => decide(tx.id, true)} className="gap-1">
                  <Check className="h-4 w-4" /> Tasdiqlash
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === tx.id} onClick={() => decide(tx.id, false)} className="gap-1">
                  <X className="h-4 w-4" /> Rad etish
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Trigger xatoliklari jurnali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Xatoliklar qayd etilmagan ✅</p>
          ) : errors.map((e) => (
            <div key={e.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{e.source}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), 'dd.MM.yyyy HH:mm')}</span>
                {e.sqlstate && <span className="text-xs font-mono">{e.sqlstate}</span>}
              </div>
              <p className="mt-1 text-muted-foreground break-words">{e.message}</p>
              {e.attempt_id && <p className="text-[11px] font-mono text-muted-foreground">attempt: {e.attempt_id}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}