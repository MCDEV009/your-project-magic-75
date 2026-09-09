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

  const generateBlock = async (
    bp: SubjectBlueprint,
    style: 'mcq' | 'matching' | 'written',
    count: number,
    instruction: string,
  ): Promise<GenQuestion[]> => {
    const out: GenQuestion[] = [];
    const chunk = style === 'written' ? 5 : 8;
    for (let i = 0; i < count; i += chunk) {
      const n = Math.min(chunk, count - i);
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
      if (error) throw error;
      const qs: GenQuestion[] = data?.questions || [];
      out.push(...qs.slice(0, n));
      setDone((d) => d + qs.slice(0, n).length);
    }
    return out;
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

      setStep("Blok 1: Yopiq testlar yaratilmoqda...");
      const b1 = await generateBlock(bp, 'mcq', bp.blocks[0].to - bp.blocks[0].from + 1, bp.blocks[0].instruction);

      setStep('Blok 2: Moslashtirish savollari yaratilmoqda...');
      const b2 = await generateBlock(bp, 'matching', bp.blocks[1].to - bp.blocks[1].from + 1, bp.blocks[1].instruction);

      setStep('Blok 3: Ochiq / yozma savollar yaratilmoqda...');
      const b3 = await generateBlock(bp, 'written', bp.blocks[2].to - bp.blocks[2].from + 1, bp.blocks[2].instruction);

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

      const all = [...b1, ...b2, ...b3];
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
      }));
      const { error: qErr } = await supabase.from('questions').insert(rows as any);
      if (qErr) throw qErr;

      toast.success(`${rows.length} ta savolli mock yaratildi`);
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