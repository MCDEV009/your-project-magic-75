import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Search, Save } from 'lucide-react';
import { toast } from 'sonner';

type Plan = 'free' | 'pro' | 'premium';
interface PlanRow { plan: Plan; monthly_price: number; yearly_price: number; mocks_limit: number }
interface UserRow { user_id: string; email: string | null; full_name: string | null; username: string | null; balance: number; plan: Plan; expires_at: string | null }

const fmt = (n: number) => Number(n).toLocaleString('uz-UZ');

export function PlansAdminCard() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, { plan: Plan; months: number }>>({});

  const loadPlans = useCallback(async () => {
    const { data } = await supabase.from('plan_settings').select('plan,monthly_price,yearly_price,mocks_limit');
    const order: Plan[] = ['free', 'pro', 'premium'];
    setPlans(((data ?? []) as PlanRow[]).sort((a, b) => order.indexOf(a.plan) - order.indexOf(b.plan)));
  }, []);

  const loadUsers = useCallback(async (q = '') => {
    setBusy('users');
    const { data, error } = await supabase.rpc('admin_users_overview', { _search: q || null, _limit: 50 });
    setBusy(null);
    if (error) return toast.error(error.message);
    setUsers((data ?? []) as UserRow[]);
  }, []);

  useEffect(() => { loadPlans(); loadUsers(); }, [loadPlans, loadUsers]);

  const savePlan = async (p: PlanRow) => {
    setBusy(p.plan);
    const { error } = await supabase.from('plan_settings')
      .update({ monthly_price: p.monthly_price, yearly_price: p.yearly_price, mocks_limit: p.mocks_limit, updated_at: new Date().toISOString() })
      .eq('plan', p.plan);
    setBusy(null);
    error ? toast.error(error.message) : toast.success(`${p.plan.toUpperCase()} tarifi saqlandi`);
  };

  const setField = (plan: Plan, k: keyof PlanRow, v: number) =>
    setPlans((ps) => ps.map((p) => (p.plan === plan ? { ...p, [k]: v } : p)));

  const applyUserPlan = async (u: UserRow) => {
    const c = choice[u.user_id] ?? { plan: u.plan, months: 1 };
    setBusy(u.user_id);
    const { error } = await supabase.rpc('admin_set_user_plan', { _user_id: u.user_id, _plan: c.plan, _months: c.months });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Tarif o\'zgartirildi');
    loadUsers(search);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-primary" /> Tariflar va foydalanuvchilar</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Tarif narxlari va limitlari</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.plan} className="rounded-lg border p-3 space-y-2">
              <p className="font-semibold uppercase">{p.plan}</p>
              <div><Label className="text-xs">Oylik narx (so'm)</Label>
                <Input type="number" min={0} value={p.monthly_price} disabled={p.plan === 'free'} onChange={(e) => setField(p.plan, 'monthly_price', Number(e.target.value))} /></div>
              <div><Label className="text-xs">Yillik narx (so'm)</Label>
                <Input type="number" min={0} value={p.yearly_price} disabled={p.plan === 'free'} onChange={(e) => setField(p.plan, 'yearly_price', Number(e.target.value))} /></div>
              <div><Label className="text-xs">Oyiga mock soni</Label>
                <Input type="number" min={0} value={p.mocks_limit} onChange={(e) => setField(p.plan, 'mocks_limit', Number(e.target.value))} /></div>
              <Button size="sm" className="w-full" onClick={() => savePlan(p)} disabled={busy === p.plan}>
                {busy === p.plan ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Saqlash</>}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Foydalanuvchi tarifi va balansi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); loadUsers(search); }}>
            <Input placeholder="Email, ism yoki username" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="outline" disabled={busy === 'users'}>
              {busy === 'users' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
          {users.length === 0 && <p className="text-sm text-muted-foreground">Foydalanuvchi topilmadi</p>}
          {users.map((u) => {
            const c = choice[u.user_id] ?? { plan: u.plan, months: 1 };
            return (
              <div key={u.user_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.full_name || u.username || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{fmt(u.balance)} so'm</Badge>
                    <Badge>{u.plan.toUpperCase()}</Badge>
                  </div>
                </div>
                {u.expires_at && <p className="text-xs text-muted-foreground">Tugaydi: {new Date(u.expires_at).toLocaleDateString('uz-UZ')}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.plan}
                    onChange={(e) => setChoice({ ...choice, [u.user_id]: { ...c, plan: e.target.value as Plan } })}>
                    <option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option>
                  </select>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.months} disabled={c.plan === 'free'}
                    onChange={(e) => setChoice({ ...choice, [u.user_id]: { ...c, months: Number(e.target.value) } })}>
                    <option value={1}>1 oy</option><option value={3}>3 oy</option><option value={6}>6 oy</option><option value={12}>12 oy</option><option value={0}>Muddatsiz</option>
                  </select>
                  <Button size="sm" onClick={() => applyUserPlan(u)} disabled={busy === u.user_id}>
                    {busy === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tarifni o\'zgartirish'}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
