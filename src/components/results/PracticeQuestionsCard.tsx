import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import LatexRenderer from '@/components/ui/LatexRenderer';
import { toast } from 'sonner';

interface Props {
  attemptId: string;
  participantId?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function PracticeQuestionsCard({ attemptId, participantId }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setContent('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/al-xorazmiy-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          attempt_id: attemptId,
          participant_id: participantId,
          mode: 'practice',
          messages: [{
            role: 'user',
            content: "O'zlashtirmagan mavzularim bo'yicha mashq savollari tuzib ber. Har biriga javob va tushuntirish ham qo'sh.",
          }],
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) { acc += delta; setContent(acc); }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card border-accent/20 overflow-hidden">
      <div className="h-1 gradient-accent" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-accent" />
          O'zlashtirmagan mavzular bo'yicha mashq savollari
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!content && !loading && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Al Xorazmiy sizning natijalaringizga qarab kuchsiz mavzular bo'yicha shaxsiy mashq savollari yaratadi.
            </p>
            <Button onClick={generate} className="gap-2 gradient-accent border-0">
              <Sparkles className="h-4 w-4" />
              Mashq savollarini yaratish
            </Button>
          </div>
        )}
        {loading && !content && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Al Xorazmiy savollar tayyorlamoqda...</span>
          </div>
        )}
        {content && (
          <>
            <LatexRenderer
              text={content}
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
            />
            <div className="flex justify-end">
              <Button onClick={generate} variant="outline" size="sm" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Yangi savollar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
