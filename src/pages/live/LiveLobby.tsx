import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Session {
  id: string;
  code: string;
  test_id: string;
  title: string | null;
  status: "scheduled" | "lobby" | "running" | "ended";
  starts_at: string;
  duration_seconds: number;
  ends_at: string | null;
  published_at: string | null;
  host_user_id: string;
}

interface Participant {
  id: string;
  participant_id: string;
  display_name: string;
  attempt_id: string | null;
  finished_at: string | null;
}

export default function LiveLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [now, setNow] = useState(Date.now());
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);

  const stored = useMemo(() => {
    if (!code) return null;
    const raw = localStorage.getItem(`live:${code}`);
    return raw ? (JSON.parse(raw) as { participant_id: string; full_name: string }) : null;
  }, [code]);

  useEffect(() => {
    if (!code) return;
    if (!stored) {
      navigate("/live");
      return;
    }

    let cancelled = false;
    async function load() {
      const { data: sList } = await (supabase as any).rpc("find_live_session_by_code", { _code: code });
      const s = Array.isArray(sList) ? sList[0] : sList;
      if (cancelled || !s) return;
      setSession(s as Session);
      const { data: p } = await (supabase as any).rpc("get_live_participants", { _session_id: s.id });
      if (!cancelled) setParticipants((p ?? []) as Participant[]);
    }
    load();

    const ch = supabase
      .channel(`live-lobby-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants" }, load)
      .subscribe();
    const iv = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [code, navigate, stored]);

  // When running: create attempt (if missing) and redirect to test
  useEffect(() => {
    if (!session || !stored || startingRef.current) return;
    if (session.status !== "running") return;
    startingRef.current = true;
    (async () => {
      setStarting(true);
      try {
        const me = participants.find((p) => p.participant_id === stored.participant_id);
        let attemptId = me?.attempt_id ?? null;
        if (!attemptId) {
          const { data: qData } = await supabase.rpc("get_public_questions", { p_test_id: session.test_id });
          const total = (qData as unknown[] | null)?.length ?? 45;
          const { data: attempt, error } = await supabase
            .from("test_attempts")
            .insert({
              test_id: session.test_id,
              participant_id: stored.participant_id,
              total_questions: total,
              status: "in_progress",
              session_id: session.id,
            })
            .select("id")
            .single();
          if (error) throw error;
          attemptId = attempt.id;
          await supabase.from("live_participants")
            .update({ attempt_id: attemptId })
            .eq("session_id", session.id)
            .eq("participant_id", stored.participant_id);
        }
        navigate(`/test/${attemptId}`, {
          state: {
            participantId: stored.participant_id,
            fullName: stored.full_name,
            sessionCode: session.code,
            sessionEndsAt: session.ends_at,
          },
        });
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Xatolik");
        startingRef.current = false;
        setStarting(false);
      }
    })();
  }, [session, participants, stored, navigate]);

  // If already ended, redirect to results
  useEffect(() => {
    if (session?.status === "ended") navigate(`/live/${code}/results`);
  }, [session?.status, code, navigate]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const startsAt = new Date(session.starts_at).getTime();
  const secLeft = Math.max(0, Math.floor((startsAt - now) / 1000));
  const h = Math.floor(secLeft / 3600).toString().padStart(2, "0");
  const m = Math.floor((secLeft % 3600) / 60).toString().padStart(2, "0");
  const s = (secLeft % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-3xl mx-auto p-4 space-y-4">
        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <Badge variant="secondary" className="mx-auto mb-2 gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
            </Badge>
            <CardTitle className="text-2xl">{session.title ?? "Live Mock Test"}</CardTitle>
            <CardDescription>Kod: <span className="font-mono font-bold">{session.code}</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {session.status === "running" ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <Play className="h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">Test boshlandi!</p>
                <p className="text-sm text-muted-foreground">Sizga savollar yuklanmoqda...</p>
                {starting && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-3xl font-bold font-mono tabular-nums">
                  <Clock className="h-6 w-6 text-primary" />
                  {h}:{m}:{s}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Barcha ishtirokchilar bir vaqtda boshlaydi
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Ishtirokchilar ({participants.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className={`text-sm rounded-md border px-3 py-2 ${p.participant_id === stored?.participant_id ? "bg-primary/10 border-primary" : ""}`}
                  >
                    {p.display_name}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}