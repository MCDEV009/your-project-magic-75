import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Loader2, ExternalLink } from "lucide-react";

interface Session {
  id: string;
  code: string;
  test_id: string;
  status: string;
  ends_at: string | null;
  published_at: string | null;
}

interface Row {
  attempt_id: string;
  participant_id: string;
  display_name: string;
  finished_at: string | null;
  score: number | null;
  theta: number | null;
  t_score: number | null;
  rank: number | null;
}

export default function LiveResults() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [now, setNow] = useState(Date.now());
  const [finalizing, setFinalizing] = useState(false);

  const stored = useMemo(() => {
    if (!code) return null;
    const raw = localStorage.getItem(`live:${code}`);
    return raw ? (JSON.parse(raw) as { participant_id: string }) : null;
  }, [code]);

  const load = useCallback(async () => {
    if (!code) return;
    const { data: s } = await supabase.from("live_sessions").select("*").eq("code", code).maybeSingle();
    if (!s) return;
    setSession(s as Session);

    const { data: parts } = await supabase
      .from("live_participants")
      .select("participant_id, display_name, attempt_id, finished_at")
      .eq("session_id", s.id);

    const attemptIds = (parts ?? []).map((p) => p.attempt_id).filter(Boolean) as string[];
    let attempts: any[] = [];
    if (attemptIds.length) {
      const { data: att } = await supabase
        .from("test_attempts")
        .select("id, score, ai_evaluation")
        .in("id", attemptIds);
      attempts = att ?? [];
    }

    const merged: Row[] = (parts ?? []).map((p) => {
      const a = attempts.find((x) => x.id === p.attempt_id);
      const rasch = a?.ai_evaluation?._rasch as { theta?: number; t_score?: number; rank?: number } | undefined;
      return {
        attempt_id: p.attempt_id ?? "",
        participant_id: p.participant_id,
        display_name: p.display_name,
        finished_at: p.finished_at,
        score: a?.score ?? null,
        theta: rasch?.theta ?? null,
        t_score: rasch?.t_score ?? null,
        rank: rasch?.rank ?? null,
      };
    });
    merged.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    setRows(merged);
  }, [code]);

  useEffect(() => {
    load();
    if (!code) return;
    const ch = supabase
      .channel(`live-results-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants" }, load)
      .subscribe();
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [code, load]);

  // Watchdog: trigger finalize when timer expired or all done
  useEffect(() => {
    if (!session || session.published_at) return;
    const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : null;
    const timeUp = endsAt !== null && now >= endsAt;
    const total = rows.length;
    const done = rows.filter((r) => r.finished_at).length;
    const allDone = total > 0 && done === total;
    if ((timeUp || allDone) && !finalizing) {
      setFinalizing(true);
      supabase.functions.invoke("finalize-live-session", { body: { session_id: session.id } })
        .catch(console.error)
        .finally(() => {
          setFinalizing(false);
          load();
        });
    }
  }, [session, rows, now, finalizing, load]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const published = !!session.published_at;
  const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : null;
  const secLeft = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  const mm = Math.floor(secLeft / 60).toString().padStart(2, "0");
  const ss = (secLeft % 60).toString().padStart(2, "0");
  const total = rows.length;
  const done = rows.filter((r) => r.finished_at).length;
  const myAttempt = stored ? rows.find((r) => r.participant_id === stored.participant_id) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-3xl mx-auto p-4 space-y-4">
        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{published ? "Yakuniy natijalar" : "Sessiya davom etmoqda"}</CardTitle>
            <CardDescription>
              Kod: <span className="font-mono">{session.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!published ? (
              <div className="text-center space-y-3">
                {endsAt && (
                  <div className="inline-flex items-center gap-2 text-2xl font-mono font-bold">
                    <Clock className="h-5 w-5" /> {mm}:{ss}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Barcha ishtirokchilar tugatgach yoki vaqt yakunlangach natijalar chiqadi
                </p>
                <Badge variant="secondary">{done}/{total} yakunladi</Badge>
                {finalizing && (
                  <div className="inline-flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Rasch tahlili...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Ishtirokchi</div>
                  <div className="col-span-2 text-right">Ball</div>
                  <div className="col-span-2 text-right">θ</div>
                  <div className="col-span-2 text-right">T-Score</div>
                </div>
                {rows.map((r) => {
                  const isMe = stored?.participant_id === r.participant_id;
                  return (
                    <div
                      key={r.participant_id}
                      className={`grid grid-cols-12 gap-2 items-center rounded-md border px-3 py-2 text-sm ${isMe ? "bg-primary/10 border-primary" : ""}`}
                    >
                      <div className="col-span-1 font-bold">{r.rank ?? "—"}</div>
                      <div className="col-span-5 truncate">{r.display_name}{isMe && " (siz)"}</div>
                      <div className="col-span-2 text-right font-mono">{r.score?.toFixed(1) ?? "—"}</div>
                      <div className="col-span-2 text-right font-mono">{r.theta?.toFixed(2) ?? "—"}</div>
                      <div className="col-span-2 text-right font-mono">{r.t_score ?? "—"}</div>
                    </div>
                  );
                })}
                {myAttempt?.attempt_id && (
                  <div className="pt-4 text-center">
                    <Button onClick={() => navigate(`/results/${myAttempt.attempt_id}`)} className="gap-2">
                      <ExternalLink className="h-4 w-4" /> Batafsil tahlilim
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}