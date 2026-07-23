import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

const MCP_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

function UrlBox() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      toast.success("URL nusxalandi");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch p-3 rounded-lg border bg-muted/40">
      <code className="flex-1 text-xs sm:text-sm break-all font-mono px-2 py-2 rounded bg-background">
        {MCP_URL}
      </code>
      <Button onClick={copy} variant="default" className="shrink-0">
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        {copied ? "Nusxalandi" : "Nusxalash"}
      </Button>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3 list-decimal list-inside text-sm leading-relaxed">
      {items.map((s, i) => (
        <li key={i} className="pl-1">{s}</li>
      ))}
    </ol>
  );
}

export default function Connect() {
  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>AI yordamchisiga ulash — Milliy Sertifikat</title>
        <meta name="description" content="Milliy Sertifikat MCP serverini ChatGPT yoki Claude'ga ulang va o'z hisobingiz ostida testlar bilan ishlang." />
      </Helmet>
      <Header />
      <main className="flex-1 container max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">AI yordamchisiga ulash</h1>
          <p className="text-muted-foreground">
            ChatGPT yoki Claude bilan Milliy Sertifikat asboblariga to'g'ridan-to'g'ri murojaat qiling.
            Har bir ulanish sizning hisobingiz ostida ishlaydi.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>MCP server manzili</CardTitle>
            <CardDescription>Ushbu URL'ni ulash paytida yordamchiga joylang.</CardDescription>
          </CardHeader>
          <CardContent>
            <UrlBox />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ulash bosqichlari</CardTitle>
            <CardDescription>Yordamchini tanlang va bosqichlarga amal qiling.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="chatgpt">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                <TabsTrigger value="claude">Claude</TabsTrigger>
              </TabsList>
              <TabsContent value="chatgpt">
                <Steps items={[
                  "chatgpt.com sozlamalarida Connectors → Advanced bo'limiga o'ting va Developer mode'ni yoqing (ogohlantirishni o'qing).",
                  "Suhbat oynasidagi \"+\" tugmasidan Developer mode'ni yoqing.",
                  "\"Add sources\" → \"Connect more\" ni bosing.",
                  "Konnektorga nom bering va yuqoridagi MCP URL'ni joylang.",
                  "ChatGPT'dan Milliy Sertifikat asboblaridan foydalanishni so'rang.",
                ]} />
              </TabsContent>
              <TabsContent value="claude">
                <Steps items={[
                  "claude.ai/customize/connectors sahifasini oching va \"Add custom connector\" ni bosing.",
                  "Konnektorga nom bering va yuqoridagi MCP URL'ni joylang.",
                  "Suhbat oynasida konnektorni yoqing va Claude'dan foydalanishni so'rang.",
                ]} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yangilanishlardan keyin qayta yuklash</CardTitle>
            <CardDescription>
              Ilova yangilangach, ulangan yordamchi eski ro'yxatni saqlab qoladi — asboblarni yangilash zarur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="chatgpt">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                <TabsTrigger value="claude">Claude</TabsTrigger>
              </TabsList>
              <TabsContent value="chatgpt">
                <Steps items={[
                  "ChatGPT sozlamalarida \"Enabled apps\" ro'yxatidan Milliy Sertifikatni tanlang.",
                  "\"Information\" yonidagi \"Refresh\" tugmasini bosing.",
                  "Agar URL o'zgargan bo'lsa, yuqoridagi eng oxirgi URL'ni qayta joylang.",
                  "Yangi suhbat oching va yordamchidan foydalanishni so'rang.",
                ]} />
              </TabsContent>
              <TabsContent value="claude">
                <Steps items={[
                  "Connectors sahifasida ushbu konnektorni oching.",
                  "Asboblarni yangilash tugmasini bosing.",
                  "URL o'zgargan bo'lsa, yuqoridagi eng oxirgi URL'ni qayta joylang.",
                  "Claude'dan foydalanishni so'rang.",
                ]} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}