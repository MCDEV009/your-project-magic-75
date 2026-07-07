import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";

export function LiveGate({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("code")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.code) {
        navigate(`/live/${data.code}/results`, { replace: true });
      } else {
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        {status === "loading" ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-muted-foreground">Sessiya topilmadi</p>
        )}
      </main>
    </div>
  );
}