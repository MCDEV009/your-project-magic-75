import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const [verifying, setVerifying] = useState(requireAdmin);
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);

  // Server-side re-verification of admin role on every mount/route change
  useEffect(() => {
    let cancelled = false;
    if (!requireAdmin) {
      setVerifying(false);
      return;
    }
    if (!user) {
      setVerifying(false);
      return;
    }
    setVerifying(true);
    (async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (cancelled) return;
      const ok = !!data && !error;
      setServerAdmin(ok);
      setVerifying(false);
      if (!ok) {
        toast.error("Sizda admin huquqlari yo'q");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireAdmin, user, location.pathname]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const state = requireAdmin ? { adminRequired: true } : undefined;
    return <Navigate to="/auth" state={state} replace />;
  }

  if (requireAdmin && (!isAdmin || serverAdmin === false)) {
    return <Navigate to="/" state={{ adminRequired: true, notAuthorized: true }} replace />;
  }

  return <>{children}</>;
}
