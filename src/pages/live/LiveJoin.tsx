import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radio, Users, Loader2 } from "lucide-react";

function genPid() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function LiveJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c || !n) {
      toast.error("Ism va kodni kiriting");
      return;
    }
    setLoading(true);
    try {
      const { data: session, error } = await supabase
        .from("live_sessions")
        .select("id, code, status, test_id")
        .eq("code", c)
        .maybeSingle();
      if (error || !session) {
        toast.error("Sessiya topilmadi");
        setLoading(false);
        return;
      }
      if (session.status === "ended") {
        toast.error("Sessiya tugagan");
        setLoading(false);
        return;
      }

      const storeKey = `live:${c}`;
      const existing = localStorage.getItem(storeKey);
      let pid = existing ? JSON.parse(existing).participant_id : genPid();

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;

      // Ensure a test_participants row exists (some flows require it)
      await supabase.from("test_participants").upsert(
        { participant_id: pid, full_name: n, user_id: uid },
        { onConflict: "participant_id" },
      );

      const { error: insErr } = await supabase.from("live_participants").upsert(
        {
          session_id: session.id,
          participant_id: pid,
          display_name: n,
          user_id: uid,
        },
        { onConflict: "session_id,participant_id" },
      );
      if (insErr) throw insErr;

      localStorage.setItem(storeKey, JSON.stringify({ participant_id: pid, full_name: n }));
      navigate(`/live/${c}/lobby`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-elevated">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Radio className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Live Mock Testga qo'shilish</CardTitle>
            <CardDescription>Sessiya kodi va ismingizni kiriting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sessiya kodi</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="uppercase tracking-widest font-mono text-center text-lg"
              />
            </div>
            <div>
              <Label>Ismingiz</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.I.SH" />
            </div>
            <Button className="w-full" onClick={handleJoin} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Users className="h-4 w-4 mr-2" /> Qo'shilish</>}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}