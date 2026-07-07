import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Square, Copy, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface LiveSession {
  id: string;
  code: string;
  test_id: string;
  title: string | null;
  status: string;
  starts_at: string;
  duration_seconds: number;
  ends_at: string | null;
  published_at: string | null;
}

interface TestRow { id: string; title_uz: string; test_format: string | null }

export function LiveSessionsAdmin() {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [testId, setTestId] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16));
  const [duration, setDuration] = useState(90);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tests").select("id, title_uz, test_format").order("created_at", { ascending: false });
      setTests((data ?? []) as TestRow[]);
    })();
  }, []);

  const loadSessions = async () => {
    const { data } = await supabase.from("live_sessions").select("*").order("created_at", { ascending: false }).limit(30);
    const list = (data ?? []) as LiveSession[];
    setSessions(list);
    const counts: Record<string, { total: number; done: number }> = {};
    for (const s of list) {
      const { data: parts } = await supabase.from("live_participants").select("finished_at").eq("session_id", s.id);
      counts[s.id] = {
        total: parts?.length ?? 0,
        done: (parts ?? []).filter((p) => p.finished_at).length,
      };
    }
    setParticipantCounts(counts);
  };

  useEffect(() => {
    loadSessions();
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, loadSessions)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants" }, loadSessions)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSession = async () => {
    if (!testId || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("live_sessions").insert({
        test_id: testId,
        host_user_id: user.id,
        title: title || null,
        starts_at: new Date(startsAt).toISOString(),
        duration_seconds: duration * 60,
      });
      if (error) throw error;
      toast.success("Sessiya yaratildi");
      setTitle("");
      loadSessions();
    } catch (e: any) {
      toast.error(e?.message ?? "Xatolik");
    } finally {
      setCreating(false);
    }
  };

  const startNow = async (id: string) => {
    const { error } = await supabase.functions.invoke("start-live-session", { body: { session_id: id } });
    if (error) toast.error(error.message);
    else { toast.success("Boshlandi"); loadSessions(); }
  };

  const endNow = async (id: string) => {
    await supabase.from("live_sessions").update({ ends_at: new Date().toISOString() }).eq("id", id);
    const { error } = await supabase.functions.invoke("finalize-live-session", { body: { session_id: id } });
    if (error) toast.error(error.message);
    else { toast.success("Yakunlandi"); loadSessions(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="h-6 w-6 text-primary" /> Live Mock Sessiyalari</h1>

      <Card>
        <CardHeader><CardTitle>Yangi sessiya yaratish</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Test</Label>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger><SelectValue placeholder="Testni tanlang" /></SelectTrigger>
              <SelectContent>
                {tests.map((t) => (<SelectItem key={t.id} value={t.id}>{t.title_uz}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sarlavha (ixtiyoriy)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live Mock #1" />
          </div>
          <div>
            <Label>Boshlanish vaqti</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <Label>Davomiyligi (daqiqa)</Label>
            <Input type="number" min={5} max={300} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={createSession} disabled={!testId || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yaratish"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sessiyalar</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">Hozircha sessiya yo'q</p>}
            {sessions.map((s) => {
              const c = participantCounts[s.id] ?? { total: 0, done: 0 };
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold">{s.code}</code>
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(s.code); toast.success("Nusxa olindi"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Badge variant={s.status === "running" ? "default" : s.status === "ended" ? "secondary" : "outline"}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{s.title ?? tests.find((t) => t.id === s.test_id)?.title_uz}</p>
                    <p className="text-xs text-muted-foreground">
                      <Users className="inline h-3 w-3" /> {c.done}/{c.total} yakunladi · {s.duration_seconds / 60} daq
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {s.status !== "running" && s.status !== "ended" && (
                      <Button size="sm" onClick={() => startNow(s.id)}>
                        <Play className="h-3 w-3 mr-1" /> Boshlash
                      </Button>
                    )}
                    {s.status === "running" && (
                      <Button size="sm" variant="destructive" onClick={() => endNow(s.id)}>
                        <Square className="h-3 w-3 mr-1" /> Yakunlash
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => window.open(`/live/${s.code}/results`, "_blank")}>Natijalar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}