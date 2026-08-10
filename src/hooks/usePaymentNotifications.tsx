import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentNotice {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
}

const SEEN_KEY = 'payment_status_seen_v1';
const DISMISS_KEY = 'payment_status_dismissed_v1';

const readMap = (key: string): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const writeMap = (key: string, value: Record<string, string>) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

const money = (n: number, c = 'UZS') =>
  new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + ' ' + c;

/**
 * Tracks the current user's top-up payments and surfaces
 * pending / approved / rejected notifications (toast + banner data).
 */
export function usePaymentNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => readMap(DISMISS_KEY));
  const firstLoad = useRef(true);

  const notify = useCallback((rows: PaymentNotice[], announceAll: boolean) => {
    const seen = readMap(SEEN_KEY);
    let changed = false;
    for (const row of rows) {
      const prev = seen[row.id];
      if (prev === row.status) continue;
      const isNew = prev === undefined;
      if (!isNew || announceAll) {
        if (row.status === 'paid') {
          toast.success('To\u2018lov tasdiqlandi', {
            description: `${money(row.amount, row.currency)} balansingizga qo\u2018shildi.`,
          });
        } else if (row.status === 'failed' || row.status === 'cancelled') {
          toast.error('To\u2018lov rad etildi', {
            description: `${money(row.amount, row.currency)} so\u2018rovingiz bekor qilindi.`,
          });
        } else if (row.status === 'refunded') {
          toast('To\u2018lov qaytarildi', { description: money(row.amount, row.currency) });
        } else if (row.status === 'pending' && !isNew) {
          toast('To\u2018lov kutilmoqda', { description: money(row.amount, row.currency) });
        }
      }
      seen[row.id] = row.status;
      changed = true;
    }
    if (changed) writeMap(SEEN_KEY, seen);
  }, []);

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from('wallet_transactions')
      .select('id, amount, currency, provider, status, created_at, paid_at, user_id, type')
      .eq('user_id', user.id)
      .eq('type', 'topup')
      .order('created_at', { ascending: false })
      .limit(20);
    const rows = ((data ?? []) as any[])
      .filter((r) => r.user_id === user.id)
      .map((r) => ({
        id: r.id, amount: r.amount, currency: r.currency, provider: r.provider,
        status: r.status as PaymentStatus, created_at: r.created_at, paid_at: r.paid_at,
      }));
    setItems(rows);
    notify(rows, !firstLoad.current);
    firstLoad.current = false;
    setLoading(false);
  }, [user, notify]);

  useEffect(() => { load(); }, [load]);

  // Realtime + polling fallback
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`payment-notices-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wallet_transactions',
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    const timer = setInterval(load, 20000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, [user, load]);

  const dismiss = useCallback((id: string, status: PaymentStatus) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: status };
      writeMap(DISMISS_KEY, next);
      return next;
    });
  }, []);

  const pending = items.filter((i) => i.status === 'pending' && dismissed[i.id] !== 'pending');
  const resolved = items.filter(
    (i) => i.status !== 'pending' && dismissed[i.id] !== i.status &&
      Date.now() - new Date(i.paid_at ?? i.created_at).getTime() < 1000 * 60 * 60 * 72,
  );

  return { items, pending, resolved, loading, reload: load, dismiss };
}
