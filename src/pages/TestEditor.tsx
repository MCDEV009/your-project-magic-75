import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Test, Question, Subject } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WrittenQuestionForm } from '@/components/admin/WrittenQuestionForm';
import { AIQuestionGenerator } from '@/components/admin/AIQuestionGenerator';
import LatexRenderer from '@/components/ui/LatexRenderer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  GripVertical,
  Image as ImageIcon,
  Save,
  CheckSquare,
  PenLine,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

type QuestionType = 'single_choice' | 'written';

interface McqFormData {
  question_text_uz: string;
  question_text_ru: string;
  options: string[];
  correct_option: number;
  image_url: string;
  points: number;
}

interface WrittenFormData {
  question_text_uz: string;
  question_text_ru: string;
  condition_a_uz: string;
  condition_a_ru: string;
  condition_b_uz: string;
  condition_b_ru: string;
  model_answer_uz: string;
  model_answer_ru: string;
  rubric_uz: string;
  rubric_ru: string;
  max_points: number;
  points_a?: number;
  points_b?: number;
  image_url: string;
}

function TestEditorContent() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');
  
  const [mcqForm, setMcqForm] = useState<McqFormData>({
    question_text_uz: '',
    question_text_ru: '',
    options: ['', '', '', ''],
    correct_option: 0,
    image_url: '',
    points: 1
  });

  const [writtenForm, setWrittenForm] = useState<WrittenFormData>({
    question_text_uz: '',
    question_text_ru: '',
    condition_a_uz: '',
    condition_a_ru: '',
    condition_b_uz: '',
    condition_b_ru: '',
    model_answer_uz: '',
    model_answer_ru: '',
    rubric_uz: '',
    rubric_ru: '',
    max_points: 3.2,
    points_a: 1.5,
    points_b: 1.7,
    image_url: ''
  });

  // Fetch test, questions, and subjects
  useEffect(() => {
    if (!testId) return;
    
    async function fetchData() {
      const [testResult, questionsResult, subjectsResult] = await Promise.all([
        supabase.from('tests').select('*').eq('id', testId).single(),
        supabase.from('questions').select('*').eq('test_id', testId).order('order_index'),
        supabase.from('subjects').select('*').order('name_uz')
      ]);
      
      if (testResult.data) {
        setTest(testResult.data as Test);
      }
      
      if (questionsResult.data) {
        setQuestions(questionsResult.data as Question[]);
      }
      
      if (subjectsResult.data) {
        setSubjects(subjectsResult.data as Subject[]);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [testId]);

  const refreshQuestions = async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .order('order_index');
    
    if (data) {
      setQuestions(data as Question[]);
    }
  };

  const resetForms = () => {
    setMcqForm({
      question_text_uz: '',
      question_text_ru: '',
      options: ['', '', '', ''],
      correct_option: 0,
      image_url: '',
      points: 1
    });
    setWrittenForm({
      question_text_uz: '',
      question_text_ru: '',
      condition_a_uz: '',
      condition_a_ru: '',
      condition_b_uz: '',
      condition_b_ru: '',
      model_answer_uz: '',
      model_answer_ru: '',
      rubric_uz: '',
      rubric_ru: '',
      max_points: 3.2,
      points_a: 1.5,
      points_b: 1.7,
      image_url: ''
    });
    setEditingQuestion(null);
    setQuestionType('single_choice');
  };

  const handleOpenQuestionDialog = (question?: Question) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionType(question.question_type);
      
      if (question.question_type === 'single_choice') {
        setMcqForm({
          question_text_uz: question.question_text_uz,
          question_text_ru: question.question_text_ru || '',
          options: question.options as string[],
          correct_option: question.correct_option,
          image_url: question.image_url || '',
          points: question.points
        });
      } else {
        setWrittenForm({
          question_text_uz: question.question_text_uz,
          question_text_ru: question.question_text_ru || '',
          condition_a_uz: (question as any).condition_a_uz || '',
          condition_a_ru: (question as any).condition_a_ru || '',
          condition_b_uz: (question as any).condition_b_uz || '',
          condition_b_ru: (question as any).condition_b_ru || '',
          model_answer_uz: question.model_answer_uz || '',
          model_answer_ru: question.model_answer_ru || '',
          rubric_uz: question.rubric_uz || '',
          rubric_ru: question.rubric_ru || '',
          max_points: question.max_points || 3.2,
          points_a: (question as any).points_a ?? 1.5,
          points_b: (question as any).points_b ?? 1.7,
          image_url: question.image_url || ''
        });
      }
    } else {
      resetForms();
    }
    setQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    const isMcq = questionType === 'single_choice';
    const form = isMcq ? mcqForm : writtenForm;
    
    if (!form.question_text_uz.trim()) {
      toast.error('Savol matnini kiriting');
      return;
    }
    
    if (isMcq) {
      const filledOptions = mcqForm.options.filter(o => o.trim());
      if (filledOptions.length < 2) {
        toast.error('Kamida 2 ta variant kerak');
        return;
      }
    } else {
      if (!writtenForm.model_answer_uz.trim()) {
        toast.error('Namunaviy javobni kiriting');
        return;
      }
    }
    
    const mcqQuestionCount = questions.filter(q => q.question_type === 'single_choice').length;
    const writtenQuestionCount = questions.filter(q => q.question_type === 'written').length;
    
    // Calculate order_index: MCQs first (0-34), then written (35-44)
    let orderIndex = editingQuestion 
      ? editingQuestion.order_index 
      : isMcq 
        ? mcqQuestionCount 
        : 35 + writtenQuestionCount;
    
    const baseData = {
      test_id: testId,
      question_type: questionType,
      order_index: orderIndex
    };
    
    const questionData = isMcq ? {
      ...baseData,
      question_text_uz: mcqForm.question_text_uz.trim(),
      question_text_ru: mcqForm.question_text_ru.trim() || null,
      options: mcqForm.options.filter(o => o.trim()),
      correct_option: mcqForm.correct_option,
      image_url: mcqForm.image_url.trim() || null,
      points: mcqForm.points,
      max_points: mcqForm.points
    } : {
      ...baseData,
      question_text_uz: writtenForm.question_text_uz.trim(),
      question_text_ru: writtenForm.question_text_ru.trim() || null,
      condition_a_uz: writtenForm.condition_a_uz.trim() || null,
      condition_a_ru: writtenForm.condition_a_ru.trim() || null,
      condition_b_uz: writtenForm.condition_b_uz.trim() || null,
      condition_b_ru: writtenForm.condition_b_ru.trim() || null,
      model_answer_uz: writtenForm.model_answer_uz.trim(),
      model_answer_ru: writtenForm.model_answer_ru.trim() || null,
      rubric_uz: writtenForm.rubric_uz.trim() || null,
      rubric_ru: writtenForm.rubric_ru.trim() || null,
      image_url: writtenForm.image_url.trim() || null,
      max_points: (writtenForm.points_a ?? 1.5) + (writtenForm.points_b ?? 1.7),
      points_a: writtenForm.points_a ?? 1.5,
      points_b: writtenForm.points_b ?? 1.7,
      points: 0,
      options: [],
      correct_option: 0
    };
    
    if (editingQuestion) {
      const { error } = await supabase
        .from('questions')
        .update(questionData as any)
        .eq('id', editingQuestion.id);
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Savol yangilandi');
        setQuestions(questions.map(q => 
          q.id === editingQuestion.id ? { ...q, ...questionData } as Question : q
        ));
      }
    } else {
      const { data, error } = await supabase
        .from('questions')
        .insert(questionData as any)
        .select()
        .single();
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Savol qo\'shildi');
        setQuestions([...questions, data as Question]);
      }
    }
    
    setQuestionDialogOpen(false);
    resetForms();
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionToDelete.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Savol o\'chirildi');
      setQuestions(questions.filter(q => q.id !== questionToDelete.id));
    }
    
    setDeleteDialogOpen(false);
    setQuestionToDelete(null);
  };

  const mcqQuestions = questions.filter(q => q.question_type === 'single_choice');
  const writtenQuestions = questions.filter(q => q.question_type === 'written');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Test topilmadi</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="test-container">
          <div className="flex h-16 items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/urecheater')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold truncate">{test.title_uz}</h1>
              <p className="text-sm text-muted-foreground">
                {mcqQuestions.length} test + {writtenQuestions.length} yozma savol
              </p>
            </div>
            <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenQuestionDialog()} className="gap-2 gradient-primary border-0">
                  <Plus className="h-4 w-4" />
                  {t('addQuestion')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingQuestion ? t('editQuestion') : t('addQuestion')}</DialogTitle>
                  <DialogDescription>Savol ma'lumotlarini kiriting</DialogDescription>
                </DialogHeader>
                
                {/* Question Type Selector */}
                {!editingQuestion && (
                  <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="single_choice" className="gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Test savoli
                      </TabsTrigger>
                      <TabsTrigger value="written" className="gap-2">
                        <PenLine className="h-4 w-4" />
                        Yozma savol
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                
                <div className="space-y-4 py-4">
                  {questionType === 'single_choice' ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t('questionText')} (O'zbekcha) *</Label>
                        <Textarea
                          value={mcqForm.question_text_uz}
                          onChange={(e) => setMcqForm({ ...mcqForm, question_text_uz: e.target.value })}
                          placeholder="Savol matnini kiriting..."
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{t('questionText')} (Ruscha)</Label>
                        <Textarea
                          value={mcqForm.question_text_ru}
                          onChange={(e) => setMcqForm({ ...mcqForm, question_text_ru: e.target.value })}
                          placeholder="Текст вопроса..."
                          rows={2}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Rasm URL (ixtiyoriy)
                        </Label>
                        <Input
                          value={mcqForm.image_url}
                          onChange={(e) => setMcqForm({ ...mcqForm, image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Javob variantlari *</Label>
                        {mcqForm.options.map((option, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                              {String.fromCharCode(65 + i)}
                            </span>
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...mcqForm.options];
                                newOptions[i] = e.target.value;
                                setMcqForm({ ...mcqForm, options: newOptions });
                              }}
                              placeholder={`${i + 1}-variant`}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('correctOption')}</Label>
                          <Select
                            value={mcqForm.correct_option.toString()}
                            onValueChange={(value) => setMcqForm({ ...mcqForm, correct_option: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {mcqForm.options.map((option, i) => (
                                option.trim() && (
                                  <SelectItem key={i} value={i.toString()}>
                                    {String.fromCharCode(65 + i)} - {option.slice(0, 30)}...
                                  </SelectItem>
                                )
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            ✨ Ball avtomatik belgilanadi (Rasch modeli asosida)
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <WrittenQuestionForm
                      form={writtenForm}
                      onChange={(updates) => setWrittenForm({ ...writtenForm, ...updates })}
                    />
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setQuestionDialogOpen(false);
                    resetForms();
                  }}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleSaveQuestion} className="gap-2 gradient-primary border-0">
                    <Save className="h-4 w-4" />
                    {t('save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Questions list */}
      <main className="test-container py-8 space-y-6">
        {/* AI Generator Toggle */}
        <div className="flex justify-end">
          <Button
            variant={showAIGenerator ? "secondary" : "outline"}
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {showAIGenerator ? 'AI Generatorni yopish' : 'AI bilan savol yaratish'}
          </Button>
        </div>

        {/* AI Question Generator */}
        {showAIGenerator && (
          <AIQuestionGenerator
            testId={testId!}
            subjects={subjects}
            onQuestionsAdded={refreshQuestions}
          />
        )}

        {questions.length === 0 && !showAIGenerator ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Hozircha savollar yo'q</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => handleOpenQuestionDialog()} className="gap-2 gradient-primary border-0">
                  <Plus className="h-4 w-4" />
                  Qo'lda qo'shish
                </Button>
                <Button onClick={() => setShowAIGenerator(true)} variant="outline" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI bilan yaratish
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : questions.length > 0 && (
          <div className="space-y-6">
            {/* MCQ Questions */}
            {mcqQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Test savollari ({mcqQuestions.length})
                </h2>
                {mcqQuestions.map((question, index) => (
                  <Card key={question.id} className="shadow-card hover:shadow-elevated transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="h-5 w-5 cursor-grab" />
                          <Badge variant="outline" className="font-mono">
                            #{index + 1}
                          </Badge>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {question.image_url && (
                            <img 
                              src={question.image_url} 
                              alt="Question" 
                              className="max-h-32 rounded-lg border mb-3"
                            />
                          )}
                          <p className="font-medium mb-3"><LatexRenderer text={question.question_text_uz} /></p>
                          <div className="grid grid-cols-2 gap-2">
                            {(question.options as string[]).map((option, i) => (
                              <div
                                key={i}
                                className={`px-3 py-2 rounded-lg text-sm border ${
                                  i === question.correct_option 
                                    ? 'border-success bg-success/10 text-success' 
                                    : 'border-muted'
                                }`}
                              >
                                <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                                <LatexRenderer text={option} />
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary">{question.points} ball</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenQuestionDialog(question)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setQuestionToDelete(question);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Written Questions */}
            {writtenQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <PenLine className="h-5 w-5" />
                  Yozma savollar ({writtenQuestions.length})
                </h2>
                {writtenQuestions.map((question, index) => (
                  <Card key={question.id} className="shadow-card hover:shadow-elevated transition-shadow border-accent/30">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="h-5 w-5 cursor-grab" />
                          <Badge variant="outline" className="font-mono border-accent text-accent">
                            #{mcqQuestions.length + index + 1}
                          </Badge>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {question.image_url && (
                            <img 
                              src={question.image_url} 
                              alt="Question" 
                              className="max-h-32 rounded-lg border mb-3"
                            />
                          )}
                          <p className="font-medium mb-2">{question.question_text_uz}</p>
                          {question.model_answer_uz && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Namunaviy javob:</span> {question.model_answer_uz.slice(0, 100)}...
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Badge className="bg-accent text-accent-foreground">
                            0-{question.max_points || 2} ball
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenQuestionDialog(question)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setQuestionToDelete(question);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Savolni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              Bu savolni o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TestEditor() {
  return (
    <LanguageProvider>
      <TestEditorContent />
    </LanguageProvider>
  );
}
