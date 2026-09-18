import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Subject } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { EXAM_CATEGORIES, type SubjectBlueprint } from '@/lib/examBlueprints';

interface Props {
  subjects: Subject[];
  onCreated?: () => void;
}

interface GenQuestion {
  type: 'single_choice' | 'written';
  question_text: string;
  options?: string[];
  correct_option?: number;
  explanation?: string;
  model_answer?: string;
  rubric?: string;
  condition_a?: string;
  condition_b?: string;
}

export function FullMockGenerator({ subjects, onCreated }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SubjectBlueprint | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [done, setDone] = useState(0);

  const isValid = (q: GenQuestion, style: 'mcq' | 'matching' | 'written') => {
    if (!q?.question_text || typeof q.question_text !== 'string') return false;
    if (style === 'written') return q.type === 'written';
    return Array.isArray(q.options)
      && q.options.length === 4
      && q.options.every((o) => typeof o === 'string' && o.trim().length > 0)
      && typeof q.correct_option === 'number'
      && q.correct_option >= 0 && q.correct_option <= 3;
  };

  const generateBlock = async (
    bp: SubjectBlueprint,
    style: 'mcq' | 'matching' | 'written',
    count: number,
    instruction: string,
  ): Promise<GenQuestion[]> => {
    const out: GenQuestion[] = [];
    const chunk = style === 'written' ? 5 : 8;
    let guard = 0;
    let rateLimitHits = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Blok to'lguncha davom etamiz (AI kam yoki yaroqsiz savol qaytarsa qayta so'raladi)
    while (out.length < count && guard < 12) {
      guard++;
      const n = Math.min(chunk, count - out.length);
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          subject: bp.name,
          questionType: style === 'written' ? 'written' : 'single_choice',
          style: style === 'matching' ? 'matching' : 'mcq',
          difficulty: 'medium',
          count: n,
          topic: bp.topics,
          instruction,
          language: 'uz',
        },
      });
      if (error) {
        const msg = String((error as any)?.message ?? '');
        // AI limiti (429) — kutib, qayta urinamiz (guard hisobiga)
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
          rateLimitHits++;
          if (rateLimitHits > 4) throw new Error("AI xizmati limiti tugadi. Bir necha daqiqadan keyin qayta urinib ko'ring.");
          await sleep(15000 * rateLimitHits);
          guard--; // limit urinishi blok urinishi sifatida hisoblanmasin
          continue;
        }
        throw error;
      }
      const raw: GenQuestion[] = Array.isArray(data?.questions) ? data.questions : [];
      const seen = new Set(out.map((q) => q.question_text.trim().toLowerCase()));
      const good = raw
        .map((q) => ({ ...q, type: style === 'written' ? 'written' as const : 'single_choice' as const }))
        .filter((q) => isValid(q, style))
        .filter((q) => {
          const k = q.question_text.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, count - out.length);
      out.push(...good);
      setDone((d) => d + good.length);
    }

    if (out.length < count) {
      throw new Error(`${style} bloki to'liq yaratilmadi (${out.length}/${count}). Qayta urinib ko'ring.`);
    }
    return out.slice(0, count);
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setBusy(true);
    setDone(0);
    try {
      const bp = selected;
      const subjectRow = subjects.find(
        (s) => s.name_uz.toLowerCase().trim() === bp.name.toLowerCase().trim(),
      );

      const all: GenQuestion[] = [];
      for (let bi = 0; bi < bp.blocks.length; bi++) {
        const blk = bp.blocks[bi];
        const need = blk.to - blk.from + 1;
        setStep(`${blk.label} yaratilmoqda (${need} ta savol)...`);
        const qs = await generateBlock(bp, blk.style, need, blk.instruction);
        all.push(...qs);
      }

      if (all.length !== bp.totalQuestions) {
        throw new Error(`Savollar soni mos kelmadi: ${all.length}/${bp.totalQuestions}`);
      }


      setStep('Test saqlanmoqda...');
      const { data: { user } } = await supabase.auth.getUser();
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          title_uz: `${bp.name} — To'liq Mock (AI)`,
          description_uz: `BMBA formatidagi to'liq mock imtihon: ${bp.totalQuestions} savol, ${bp.durationMinutes} daqiqa.`,
          subject_id: subjectRow?.id ?? null,
          visibility: 'private',
          duration_minutes: bp.durationMinutes,
          test_format: 'milliy_sertifikat',
          created_by: user?.id ?? null,
        } as any)
        .select()
        .single();
      if (testErr) throw testErr;

      const rows = all.map((q, i) => ({
        test_id: (test as any).id,
        question_type: q.type === 'written' ? 'written' : 'single_choice',
        question_text_uz: q.question_text,
        options: q.options || [],
        correct_option: q.correct_option ?? 0,
        points: q.type === 'written' ? 0 : 1,
        max_points: q.type === 'written' ? 2 : 1,
        order_index: i,
        model_answer_uz: q.model_answer ?? null,
        rubric_uz: q.rubric ?? null,
        condition_a_uz: q.condition_a ?? null,
        condition_b_uz: q.condition_b ?? null,
        points_a: q.type === 'written' ? 1.5 : null,
        points_b: q.type === 'written' ? 1.7 : null,
      }));
      const { error: qErr } = await supabase.from('questions').insert(rows as any);
      if (qErr) {
        // Bo'sh testni qoldirmaymiz
        await supabase.from('tests').delete().eq('id', (test as any).id);
        throw qErr;
      }

      const { count: savedCount } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('test_id', (test as any).id);
      if ((savedCount ?? 0) !== rows.length) {
        throw new Error(`Bazaga ${savedCount}/${rows.length} savol saqlandi`);
      }

      toast.success(`${rows.length} ta savol bazaga saqlandi — mock tayyor`);
      setOpen(false);
      setSelected(null);
      onCreated?.();
      navigate(`/urecheater/test/${(test as any).id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Mock yaratishda xatolik");
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const total = selected?.totalQuestions ?? 45;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full sm:w-auto border-primary/40 text-primary hover:bg-primary/10">
          <Sparkles className="h-4 w-4" />
          Yangi To'liq Mock Yaratish (AI)
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            To'liq Mock Imtihon Generatori
          </DialogTitle>
          <DialogDescription>
            Fan tanlang — AI BMBA blueprinti asosida 45 savolli (3 blok) mock imtihon yaratadi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {EXAM_CATEGORIES.map((cat) => (
            <div key={cat.key} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{cat.emoji}</span>
                <span>{cat.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.subjects.map((s) => {
                  const active = selected?.key === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={busy}
                      onClick={() => setSelected(s)}
                      className={`text-left rounded-xl border p-3 transition-all disabled:opacity-60 ${
                        active
                          ? 'border-primary bg-primary/10 shadow-glow'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.emoji} {s.name}</span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">{s.totalQuestions} savol</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.durationMinutes} daqiqa</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {selected && (
            <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Blueprint</div>
              {selected.blocks.map((b) => (
                <div key={b.label} className="flex items-center justify-between text-sm">
                  <span>{b.label}</span>
                  <span className="tabular-nums text-muted-foreground">{b.from}–{b.to}</span>
                </div>
              ))}
            </div>
          )}

          {busy && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {step}
              </div>
              <Progress value={Math.min(100, (done / total) * 100)} />
              <div className="text-xs text-muted-foreground">{done}/{total} savol tayyor</div>
            </div>
          )}

          <Button
            className="w-full gap-2 gradient-primary border-0"
            disabled={!selected || busy}
            onClick={handleGenerate}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Yaratilmoqda...' : "To'liq mockni yaratish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}