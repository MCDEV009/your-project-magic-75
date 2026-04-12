import { useState } from 'react';
import LatexRenderer from '@/components/ui/LatexRenderer';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Subject } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedQuestion {
  id: string;
  type: 'single_choice' | 'written';
  question_text: string;
  options?: string[];
  correct_option?: number;
  explanation?: string;
  model_answer?: string;
  model_answer_a?: string;
  model_answer_b?: string;
  keywords_a?: string[];
  keywords_b?: string[];
  rubric?: string;
  condition_a?: string;
  condition_b?: string;
  selected: boolean;
}

interface AIQuestionGeneratorProps {
  testId: string;
  subjects: Subject[];
  onQuestionsAdded: () => void;
}

export function AIQuestionGenerator({ testId, subjects, onQuestionsAdded }: AIQuestionGeneratorProps) {
  const { language } = useLanguage();
  
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  
  const [config, setConfig] = useState({
    subject: '',
    questionType: 'single_choice' as 'single_choice' | 'written',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    count: 5,
    topic: ''
  });

  const handleGenerate = async () => {
    if (!config.subject) {
      toast.error('Fanni tanlang');
      return;
    }

    setGenerating(true);
    setGeneratedQuestions([]);

    try {
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          subject: config.subject,
          questionType: config.questionType,
          difficulty: config.difficulty,
          count: config.count,
          topic: config.topic,
          language: language
        }
      });

      if (response.error) throw response.error;

      const questions = response.data.questions.map((q: any, i: number) => ({
        ...q,
        id: `gen-${Date.now()}-${i}`,
        selected: true
      }));

      setGeneratedQuestions(questions);
      toast.success(`${questions.length} ta savol yaratildi`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Savollarni yaratishda xatolik');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSelected = async () => {
    const selected = generatedQuestions.filter(q => q.selected);
    if (selected.length === 0) {
      toast.error('Hech qanday savol tanlanmadi');
      return;
    }

    setSaving(true);

    try {
      // Get current max order_index
      const { data: existingQuestions } = await supabase
        .from('questions')
        .select('order_index')
        .eq('test_id', testId)
        .order('order_index', { ascending: false })
        .limit(1);

      const startIndex = existingQuestions?.[0]?.order_index ?? -1;

      const questionsToInsert = selected.map((q, i) => ({
        test_id: testId,
        question_type: q.type,
        question_text_uz: q.question_text,
        options: q.options || [],
        correct_option: q.correct_option ?? 0,
        points: q.type === 'single_choice' ? 1 : 0,
        max_points: q.type === 'written' ? 2 : 1,
        order_index: startIndex + 1 + i,
        model_answer_uz: q.model_answer,
        rubric_uz: q.rubric,
        condition_a_uz: q.condition_a || null,
        condition_b_uz: q.condition_b || null
      }));

      const { error } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (error) throw error;

      toast.success(`${selected.length} ta savol qo'shildi`);
      setGeneratedQuestions([]);
      onQuestionsAdded();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'Savollarni saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const toggleQuestion = (id: string) => {
    setGeneratedQuestions(prev => 
      prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q)
    );
  };

  const removeQuestion = (id: string) => {
    setGeneratedQuestions(prev => prev.filter(q => q.id !== id));
  };

  const selectAll = (select: boolean) => {
    setGeneratedQuestions(prev => prev.map(q => ({ ...q, selected: select })));
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Savol Generatori
        </CardTitle>
        <CardDescription>
          Sun'iy intellekt yordamida Milliy Sertifikat formatida savollar yarating
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Fan</Label>
            <Select 
              value={config.subject} 
              onValueChange={(v) => setConfig(c => ({ ...c, subject: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Fanni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.name_uz}>
                    {language === 'ru' && s.name_ru ? s.name_ru : 
                     language === 'en' && s.name_en ? s.name_en : s.name_uz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Savol turi</Label>
            <Select 
              value={config.questionType} 
              onValueChange={(v: 'single_choice' | 'written') => setConfig(c => ({ ...c, questionType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_choice">Test (A/B/C/D)</SelectItem>
                <SelectItem value="written">Yozma savol</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Qiyinlik darajasi</Label>
            <Select 
              value={config.difficulty} 
              onValueChange={(v: 'easy' | 'medium' | 'hard') => setConfig(c => ({ ...c, difficulty: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Oson</SelectItem>
                <SelectItem value="medium">O'rta</SelectItem>
                <SelectItem value="hard">Qiyin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Savollar soni</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={config.count}
              onChange={(e) => setConfig(c => ({ ...c, count: parseInt(e.target.value) || 5 }))}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Mavzu (ixtiyoriy)</Label>
            <Input
              placeholder="Masalan: Algebraik tenglamalar"
              value={config.topic}
              onChange={(e) => setConfig(c => ({ ...c, topic: e.target.value }))}
            />
          </div>
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={generating || !config.subject}
          className="gap-2 gradient-primary border-0"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Yaratilmoqda...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Savollar yaratish
            </>
          )}
        </Button>

        {/* Generated Questions */}
        {generatedQuestions.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Yaratilgan savollar ({generatedQuestions.filter(q => q.selected).length}/{generatedQuestions.length} tanlangan)
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectAll(true)}>
                  Barchasini tanlash
                </Button>
                <Button variant="outline" size="sm" onClick={() => selectAll(false)}>
                  Tanlashni bekor qilish
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {generatedQuestions.map((q, i) => (
                  <Card 
                    key={q.id} 
                    className={`transition-colors ${q.selected ? 'border-primary' : 'opacity-60'}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={q.selected}
                          onCheckedChange={() => toggleQuestion(q.id)}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={q.type === 'single_choice' ? 'secondary' : 'default'}>
                              {q.type === 'single_choice' ? 'Test' : 'Yozma'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">#{i + 1}</span>
                          </div>
                          <p className="font-medium"><LatexRenderer text={q.question_text} /></p>
                          
                          {q.type === 'single_choice' && q.options && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {q.options.map((opt, oi) => (
                                <div 
                                  key={oi}
                                  className={`p-2 rounded text-sm ${oi === q.correct_option ? 'bg-success/10 text-success border border-success/30' : 'bg-muted'}`}
                                >
                                  {String.fromCharCode(65 + oi)}) <LatexRenderer text={opt} />
                                  {oi === q.correct_option && <Check className="inline h-3 w-3 ml-1" />}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.type === 'written' && (
                            <div className="mt-2 space-y-2">
                              {q.condition_a && (
                                <div className="p-2 bg-muted rounded text-sm">
                                  <span className="font-medium">a-shart:</span> <LatexRenderer text={q.condition_a} />
                                </div>
                              )}
                              {q.condition_b && (
                                <div className="p-2 bg-muted rounded text-sm">
                                  <span className="font-medium">b-shart:</span> <LatexRenderer text={q.condition_b} />
                                </div>
                              )}
                              {q.model_answer && (
                                <div className="p-2 bg-muted rounded text-sm">
                                  <span className="font-medium">Namunaviy javob:</span> {q.model_answer}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(q.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Button 
              onClick={handleSaveSelected} 
              disabled={saving || generatedQuestions.filter(q => q.selected).length === 0}
              className="w-full gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Tanlangan savollarni qo'shish ({generatedQuestions.filter(q => q.selected).length})
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
