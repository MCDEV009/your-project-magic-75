import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, ShieldAlert, Users, RefreshCw, CircleDot, CheckCircle2 } from 'lucide-react';

interface SessionRow { id: string; code: string; title: string | null; status: string }
interface ParticipantRow {
  id: string;
  display_name: string;
  participant_id: string;
  attempt_id: string | null;
  joined_at: string;
  finished_at: string | null;
}
interface ViolationRow {
  id: string;
  attempt_id: string | null;
  participant_id: string | null;
  violation_type: string;
  details: string | null;
  created_at: string;
}

const typeLabel: Record<string, string> = {
  tab_switch: 'Oynadan chiqish',
  copy: 'Nusxa olish',
  cut: 'Kesib olish',
  paste: 'Joylashtirish',
};

export function LiveMonitorPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, code, title, status')
        .order('created_at', { ascending: false })
        .limit(20);
      const list = (data ?? []) as SessionRow[];
      setSessions(list);
      const running = list.find((s) => s.status === 'running') ?? list[0];
      if (running) setSessionId(running.id);
    })();
  }, []);

  const loadViolations = useCallback(async () => {
    const { data } = await supabase
      .from('exam_violations')
      .select('id, attempt_id, participant_id, violation_type, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setViolations((data ?? []) as ViolationRow[]);
  }, []);

  const loadParticipants = useCallback(async () => {
    if (!sessionId) { setParticipants([]); return; }
    const { data } = await (supabase as any).rpc('get_live_participants', { _session_id: sessionId });
    setParticipants((data ?? []) as ParticipantRow[]);
  }, [sessionId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadParticipants(), loadViolations()]);
    setLoading(false);
  }, [loadParticipants, loadViolations]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel('admin-live-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_participants' }, () => loadParticipants())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_violations' }, () => loadViolations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadParticipants, loadViolations]);

  const attemptIds = useMemo(
    () => new Set(participants.map((p) => p.attempt_id).filter(Boolean) as string[]),
    [participants],
  );
  const sessionViolations = useMemo(
    () => (attemptIds.size ? violations.filter((v) => v.attempt_id && attemptIds.has(v.attempt_id)) : violations),
    [violations, attemptIds],
  );
  const perAttempt = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of sessionViolations) if (v.attempt_id) m[v.attempt_id] = (m[v.attempt_id] ?? 0) + 1;
    return m;
  }, [sessionViolations]);

  const active = participants.filter((p) => !p.finished_at).length;
  const finished = participants.length - active;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Real vaqt monitoringi
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sessiya" /></SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code} — {s.title ?? s.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Ishtirokchi</div>
          <div className="text-2xl font-bold">{participants.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CircleDot className="h-3 w-3 text-success" /> Faol</div>
          <div className="text-2xl font-bold">{active}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-destructive" /> Ogohlantirish</div>
          <div className="text-2xl font-bold">{sessionViolations.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ishtirokchilar holati</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {participants.length === 0 && <p className="text-sm text-muted-foreground">Ishtirokchi yo'q</p>}
          {participants.map((p) => {
            const v = p.attempt_id ? perAttempt[p.attempt_id] ?? 0 : 0;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <span className={`h-2 w-2 rounded-full ${p.finished_at ? 'bg-muted-foreground' : 'bg-success animate-pulse'}`} />
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{p.display_name}</span>
                {v > 0 && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <ShieldAlert className="h-3 w-3" /> {v}
                  </Badge>
                )}
                <Badge variant={p.finished_at ? 'secondary' : 'outline'} className="text-[10px]">
                  {p.finished_at ? <><CheckCircle2 className="h-3 w-3 mr-1" />Yakunladi</> : 'Ishlayapti'}
                </Badge>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">{finished} ta ishtirokchi yakunladi</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Anti-cheat auditi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
          {sessionViolations.length === 0 && (
            <p className="text-sm text-muted-foreground">Ogohlantirishlar qayd etilmagan</p>
          )}
          {sessionViolations.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-sm">
              <Badge variant="destructive" className="text-[10px]">{typeLabel[v.violation_type] ?? v.violation_type}</Badge>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                {v.participant_id?.slice(0, 8) ?? v.attempt_id?.slice(0, 8) ?? '—'}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">{v.details}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {new Date(v.created_at).toLocaleTimeString('uz-UZ')}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
