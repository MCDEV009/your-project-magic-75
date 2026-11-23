import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { needsAnswer, readChoice, saveChoices, onConsentChange } from "@/lib/consent";

export const OPEN_COOKIE_SETTINGS = "open-cookie-settings";
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));

const gpc = () => (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    needsAnswer(["analytics"]).then(setShow);
    const off = onConsentChange(() => needsAnswer(["analytics"]).then(setShow));
    const open = () => { setAnalytics(readChoice("analytics") === "granted"); setSettingsOpen(true); };
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => { off(); window.removeEventListener(OPEN_COOKIE_SETTINGS, open); };
  }, []);

  useEffect(() => { if (show) panelRef.current?.focus(); }, [show]);

  const decide = (choice: "granted" | "denied") => { saveChoices({ analytics: choice }); setShow(false); };

  return (
    <>
      {show && (
        <div ref={panelRef} tabIndex={-1} role="region" aria-label="Cookie sozlamalari"
          className="fixed inset-x-3 bottom-16 z-50 mx-auto max-w-xl rounded-xl border bg-card p-4 text-card-foreground shadow-xl outline-none sm:bottom-4">
          <p className="text-sm">
            Biz tashriflarni cookie'larsiz hisoblaymiz. Rozilik bersangiz, bosishlar va boshqa harakatlarni ham o'lchaymiz.{" "}
            <Link to="/about" className="underline">Batafsil</Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="flex-1" onClick={() => decide("granted")}>Hammasiga roziman</Button>
            <Button size="sm" className="flex-1" onClick={() => decide("denied")}>Hammasini rad etaman</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAnalytics(false); setSettingsOpen(true); }}>Cookie sozlamalari</Button>
          </div>
        </div>
      )}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie sozlamalari</DialogTitle>
            <DialogDescription>
              {gpc() ? "Brauzeringizning maxfiylik signali (GPC) yoqilgan, shuning uchun kuzatish o'chirilgan." : "Qaysi ma'lumotlarni yig'ishimizga ruxsat berishingizni tanlang."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><p className="text-sm font-medium">Zarur</p><p className="text-xs text-muted-foreground">Kirish va sayt ishlashi uchun. Doim yoqiq.</p></div>
              <span className="text-xs text-muted-foreground">Doim</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><p className="text-sm font-medium">Analitika, Lovable tomonidan</p><p className="text-xs text-muted-foreground">Bosishlar va harakatlarni o'lchash.</p></div>
              <Switch checked={!gpc() && analytics} disabled={gpc()} onCheckedChange={setAnalytics} aria-label="Analitika" />
            </div>
            <Button className="w-full" onClick={() => { saveChoices({ analytics: analytics ? "granted" : "denied" }); setSettingsOpen(false); setShow(false); }}>
              Saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
