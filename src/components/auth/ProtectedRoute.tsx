import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'super_admin' | 'editor' | 'analyst';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredRoles?: AppRole[];
}

async function logAudit(opts: { userId: string | null; userEmail: string | null; route: string; required: string[]; granted: boolean; }) {
  try {
    await (supabase.from('admin_audit_log') as any).insert({
      user_id: opts.userId,
      user_email: opts.userEmail,
      route: opts.route,
      required_roles: opts.required,
      granted: opts.granted,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch { /* swallow */ }
}

export function ProtectedRoute({ children, requireAdmin = false, requiredRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const needsRoleCheck = requireAdmin || (requiredRoles && requiredRoles.length > 0);
  const [verifying, setVerifying] = useState(!!needsRoleCheck);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const requiredList: AppRole[] = requiredRoles && requiredRoles.length > 0
    ? requiredRoles
    : (requireAdmin ? ['admin', 'super_admin'] : []);

  useEffect(() => {
    let cancelled = false;
    if (!needsRoleCheck) { setVerifying(false); return; }
    if (!user) { setVerifying(false); return; }
    setVerifying(true);
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', requiredList as any);
      if (cancelled) return;
      const ok = (data?.length ?? 0) > 0;
      setAuthorized(ok);
      setVerifying(false);
      logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        route: location.pathname,
        required: requiredList,
        granted: ok,
      });
      if (!ok) toast.error("Ruxsat berilmadi: yetarli huquq yo'q");
    })();
    return () => { cancelled = true; };
  }, [needsRoleCheck, user, location.pathname, requiredList.join(',')]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    if (needsRoleCheck) {
      logAudit({ userId: null, userEmail: null, route: location.pathname, required: requiredList, granted: false });
    }
    return <Navigate to="/auth" state={{ from: location.pathname, adminRequired: needsRoleCheck }} replace />;
  }

  if (needsRoleCheck && authorized === false) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
