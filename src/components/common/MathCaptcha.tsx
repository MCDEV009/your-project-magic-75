import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface CaptchaValue { token: string; answer: string }

interface Props {
  onChange: (value: CaptchaValue | null) => void;
  /** Change this number to load a new question (e.g. after a failed attempt). */
  resetKey?: number;
}

export function MathCaptcha({ onChange, resetKey = 0 }: Props) {
  const [question, setQuestion] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQuestion(null); setAnswer(""); setError(null); onChange(null);
    const { data, error } = await supabase.functions.invoke("captcha", { body: { action: "challenge" } });
    if (error || !data?.question) { setError("Tekshiruv savolini yuklab bo'lmadi"); return; }
    setQuestion(data.question); setToken(data.token);
  }, [onChange]);

  useEffect(() => { load(); }, [load, resetKey]);

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-primary" /> Robot emasligingizni tasdiqlang
      </label>
      <div className="flex items-center gap-2">
        <span className="min-w-[96px] rounded-md border bg-muted px-3 py-2 font-mono text-sm" aria-live="polite">
          {question ?? (error ? "—" : "…")}
        </span>
        <Input
          inputMode="numeric"
          placeholder="Javob"
          value={answer}
          aria-label="Tekshiruv javobi"
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d-]/g, "").slice(0, 5);
            setAnswer(v);
            onChange(v && token ? { token, answer: v } : null);
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={load} aria-label="Yangi savol">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export async function verifyCaptcha(value: CaptchaValue | null): Promise<string | null> {
  if (!value) return "Tekshiruv savoliga javob bering";
  const { data, error } = await supabase.functions.invoke("captcha", { body: { action: "verify", ...value } });
  if (error || !data?.ok) return "Tekshiruv javobi noto'g'ri. Yangi savolga javob bering.";
  return null;
}
