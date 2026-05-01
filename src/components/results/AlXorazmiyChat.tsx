import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GraduationCap, Send, Loader2, User, Sparkles } from 'lucide-react';
import LatexRenderer from '@/components/ui/LatexRenderer';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AlXorazmiyChatProps {
  attemptId: string;
  participantId?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Salom! Men **Al Xorazmiy**. Test natijalaringiz haqida savol bering — qaysi mavzuni tushunmaganingizni, qanday mashq qilishni, yoki biror savolning yechimini so'rashingiz mumkin.",
};

export function AlXorazmiyChat({ attemptId, participantId }: AlXorazmiyChatProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history (all messages for this participant across attempts)
  useEffect(() => {
    if (!participantId) { setHistoryLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from('al_xorazmiy_chat_messages')
        .select('role, content, created_at')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        setMessages([WELCOME, ...data.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))]);
      }
      setHistoryLoaded(true);
    })();
  }, [participantId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (overrideText?: string, mode?: 'practice') => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    if (!overrideText) setInput('');
    setStreaming(true);

    // Add empty assistant message we'll fill in
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/al-xorazmiy-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_KEY}`,
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            attempt_id: attemptId,
            participant_id: participantId,
            mode,
            messages: newMessages,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Xatolik yuz berdi');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const generatePractice = () => {
    send("O'zlashtirmagan mavzularim bo'yicha mashq savollari tuzib ber. Har biriga javob va tushuntirish ham qo'sh.", 'practice');
  };

  return (
    <Card className="shadow-card border-primary/20 overflow-hidden">
      <div className="h-1 gradient-primary" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
          Al Xorazmiy bilan suhbat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!historyLoaded ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <ScrollArea className="h-[400px] pr-3" ref={scrollRef as any}>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <GraduationCap className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    m.content ? (
                      <LatexRenderer
                        text={m.content}
                        className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                      />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generatePractice}
            disabled={streaming}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Mashq savollari yarat
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Savolingizni yozing..."
            disabled={streaming}
          />
          <Button onClick={() => send()} disabled={streaming || !input.trim()} className="gap-2">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}