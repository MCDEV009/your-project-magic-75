import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'super_admin' | 'editor' | 'analyst' | 'user';

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (cancelled) return;
      setRoles((data ?? []).map((r) => r.role as AppRole));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const has = (...needed: AppRole[]) => needed.some((r) => roles.includes(r));
  return {
    roles,
    loading,
    isAdmin: has('admin', 'super_admin'),
    isSuperAdmin: has('super_admin'),
    isEditor: has('editor', 'admin', 'super_admin'),
    isAnalyst: has('analyst', 'admin', 'super_admin'),
    has,
  };
}