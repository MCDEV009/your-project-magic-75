import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Plan = 'free' | 'pro' | 'premium';

export const PLAN_LIMITS: Record<Plan, { mocks: number; ai: number; images: number }> = {
  free: { mocks: 5, ai: 10, images: 3 },
  pro: { mocks: 30, ai: 100, images: 30 },
  premium: { mocks: Infinity, ai: Infinity, images: Infinity },
};

function periodKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function useUsageLimits() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [usage, setUsage] = useState({ mocks_taken: 0, ai_requests: 0, image_uploads: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setUsage({ mocks_taken: 0, ai_requests: 0, image_uploads: 0 });
      setLoading(false);
      return;
    }
    const month = periodKey();
    const [{ data: planRow }, { data: usageRow }] = await Promise.all([
      supabase.from('user_plans').select('plan, status, expires_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('usage_counters').select('*').eq('user_id', user.id).eq('period_month', month).maybeSingle(),
    ]);
    const active = planRow && planRow.status === 'active' && (!planRow.expires_at || new Date(planRow.expires_at) > new Date());
    setPlan((active ? planRow!.plan : 'free') as Plan);
    if (usageRow) setUsage({ mocks_taken: usageRow.mocks_taken, ai_requests: usageRow.ai_requests, image_uploads: usageRow.image_uploads });
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const limits = PLAN_LIMITS[plan];
  const remaining = {
    mocks: limits.mocks - usage.mocks_taken,
    ai: limits.ai - usage.ai_requests,
    images: limits.images - usage.image_uploads,
  };

  const increment = async (field: 'mocks_taken' | 'ai_requests' | 'image_uploads') => {
    if (!user) return;
    const month = periodKey();
    const { data: existing } = await supabase
      .from('usage_counters').select('*').eq('user_id', user.id).eq('period_month', month).maybeSingle();
    if (existing) {
      await supabase.from('usage_counters').update({ [field]: existing[field] + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('usage_counters').insert({ user_id: user.id, period_month: month, [field]: 1 });
    }
    refresh();
  };

  const canUse = (field: 'mocks' | 'ai' | 'images') => remaining[field] > 0;

  return { plan, usage, limits, remaining, loading, refresh, increment, canUse };
}