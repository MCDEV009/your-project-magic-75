import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Row { id: string; name: string | null; email: string | null; message: string; page: string | null; status: string; created_at: string }
const LABEL: Record<string, string> = { new: "Yangi", read: "O'qildi", done: "Hal qilindi" };

export function FeedbackAdminCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error("Fikrlarni yuklab bo'lmadi"); else setRows(data as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) { toast.error("Saqlab bo'lmadi"); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fikr-mulohazalar</CardTitle>
        <Button size="sm" variant="outline" onClick={load}>Yangilash</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Yuklanmoqda…</p> :
          rows.length === 0 ? <p className="text-sm text-muted-foreground">Hozircha fikr yo'q.</p> :
          rows.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={r.status === "new" ? "default" : "secondary"}>{LABEL[r.status] ?? r.status}</Badge>
                <span>{new Date(r.created_at).toLocaleString("uz-UZ")}</span>
                {r.name && <span>· {r.name}</span>}
                {r.email && <a className="underline" href={`mailto:${r.email}`}>· {r.email}</a>}
                {r.page && <span>· {r.page}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "read")}>O'qildi</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "done")}>Hal qilindi</Button>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
