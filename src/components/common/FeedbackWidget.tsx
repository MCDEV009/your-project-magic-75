import { useState } from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MathCaptcha, type CaptchaValue } from "./MathCaptcha";
import { readFunctionError } from "./readFunctionError";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [captcha, setCaptcha] = useState<CaptchaValue | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) { toast.error("Xabarni yozing (kamida 3 belgi)"); return; }
    if (!captcha) { toast.error("Tekshiruv savoliga javob bering"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("captcha", {
      body: { action: "feedback", name, email, message, website, page: window.location.pathname, ...captcha },
    });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(await readFunctionError(error, "Yuborib bo'lmadi, qayta urinib ko'ring"));
      setResetKey((k) => k + 1);
      return;
    }
    toast.success("Rahmat! Fikringiz yuborildi.");
    setMessage(""); setOpen(false); setResetKey((k) => k + 1);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg"
        size="sm"
        aria-label="Fikr bildirish"
      >
        <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Fikr bildirish
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fikr-mulohaza</DialogTitle>
            <DialogDescription>Taklif, xato yoki savolingizni yozing — adminlar o'qib chiqadi.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <Input placeholder="Ismingiz (ixtiyoriy)" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            <Input type="email" placeholder="Email (javob kerak bo'lsa)" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
            <Textarea placeholder="Xabaringiz…" rows={4} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} required />
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" name="website" />
            <MathCaptcha onChange={setCaptcha} resetKey={resetKey} />
            <Button type="submit" className="w-full" disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yuborish
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
