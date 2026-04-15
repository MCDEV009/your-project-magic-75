import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Question, TestAttempt, Test, WrittenAnswer } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { WrittenQuestionInput } from '@/components/test/WrittenQuestionInput';
import LatexRenderer from '@/components/ui/LatexRenderer';
import { QuestionNavigator } from '@/components/test/QuestionNavigator';
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
import { ChevronLeft, ChevronRight, Clock, Flag, Maximize, Minimize, PenLine, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function TestInterfaceContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<Map<string, { options: string[], mapping: number[] }>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, WrittenAnswer>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const participantId = (location.state as { participantId?: string })?.participantId;

  // Fetch test data
  useEffect(() => {
    async function fetchData() {
      if (!attemptId) return;
      
      // Get attempt
      const { data: attemptData, error: attemptError } = await supabase
        .rpc('get_test_attempt_by_id', { p_attempt_id: attemptId })
        .single();
      
      if (attemptError || !attemptData) {
        toast.error(t('error'));
        navigate('/');
        return;
      }
      
      if (attemptData.status === 'finished') {
        navigate(`/results/${attemptId}`);
        return;
      }
      
      setAttempt(attemptData as TestAttempt);
      setMcqAnswers((attemptData.answers || {}) as any);
      setWrittenAnswers((attemptData.written_answers || {}) as any);
      
      // Get test
      const { data: testData } = await supabase
        .from('tests')
        .select('*')
        .eq('id', attemptData.test_id)
        .single();
      
      if (testData) {
        setTest(testData as Test);
        
        // Calculate remaining time
        const startedAt = new Date(attemptData.started_at).getTime();
        const duration = testData.duration_minutes * 60 * 1000;
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, Math.floor((duration - elapsed) / 1000));
        setTimeLeft(remaining);
      }
      
      // Get questions using secure RPC function (excludes correct answers)
      const { data: questionsData } = await supabase
        .rpc('get_public_questions', { p_test_id: attemptData.test_id });
      
      if (questionsData) {
        let processedQuestions = questionsData as unknown as Question[];
        
        // For Milliy Sertifikat, keep MCQ questions first (1-35), then written (36-45)
        const mcqQuestions = processedQuestions.filter(q => q.question_type === 'single_choice');
        const writtenQuestions = processedQuestions.filter(q => q.question_type === 'written');
        
        // Randomize MCQ questions if enabled (keep written questions in order)
        if (testData?.randomize_questions) {
          processedQuestions = [...shuffleArray(mcqQuestions), ...writtenQuestions];
        } else {
          processedQuestions = [...mcqQuestions, ...writtenQuestions];
        }
        
        // Create shuffled options mapping (only for MCQ)
        const optionsMap = new Map<string, { options: string[], mapping: number[] }>();
        processedQuestions.forEach((q) => {
          if (q.question_type === 'single_choice') {
            const options = q.options as string[];
            if (testData?.randomize_options) {
              const indices = options.map((_, i) => i);
              const shuffledIndices = shuffleArray(indices);
              optionsMap.set(q.id, {
                options: shuffledIndices.map(i => options[i]),
                mapping: shuffledIndices
              });
            } else {
              optionsMap.set(q.id, {
                options: options,
                mapping: options.map((_, i) => i)
              });
            }
          }
        });
        
        setShuffledOptions(optionsMap);
        setQuestions(processedQuestions);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [attemptId, navigate, t]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 && !loading && attempt) {
      handleFinish(true);
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, loading, attempt]);

  // Auto-save every 5 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (attemptId && (Object.keys(mcqAnswers).length > 0 || Object.keys(writtenAnswers).length > 0)) {
        supabase
          .from('test_attempts')
          .update({ 
            answers: mcqAnswers as any,
            written_answers: writtenAnswers as any
          })
          .eq('id', attemptId)
          .then(() => {});
      }
    }, 5000);
    
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [attemptId, mcqAnswers, writtenAnswers]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Prevent page refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleSelectOption = (questionId: string, displayIndex: number) => {
    const optionData = shuffledOptions.get(questionId);
    if (!optionData) return;
    
    // Map display index back to original index
    const originalIndex = optionData.mapping[displayIndex];
    setMcqAnswers((prev) => ({ ...prev, [questionId]: originalIndex }));
  };

  const handleWrittenAnswerChange = (questionId: string, answer: WrittenAnswer) => {
    setWrittenAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleFinish = async (autoSubmit = false) => {
    if (submitting) return;
    
    if (!autoSubmit) {
      setShowFinishDialog(true);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          answers: mcqAnswers as any,
          written_answers: writtenAnswers as any,
          evaluation_status: 'pending'
        })
        .eq('id', attemptId);
      
      if (updateError) {
        console.error('Failed to finish attempt:', updateError);
        toast.error(t('error'));
        setSubmitting(false);
        return;
      }
      
      // Trigger server-side evaluation after confirmed finish
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-written-answers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ attempt_id: attemptId })
        });
      } catch (err) {
        console.error('Evaluation trigger error:', err);
      }
      
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      navigate(`/results/${attemptId}`);
    } catch (error) {
      toast.error(t('error'));
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const currentOptions = currentQuestion?.question_type === 'single_choice' 
    ? shuffledOptions.get(currentQuestion.id) 
    : null;
  const currentMcqAnswer = currentQuestion?.question_type === 'single_choice' 
    ? mcqAnswers[currentQuestion.id] 
    : undefined;
  const currentDisplayAnswer = currentMcqAnswer !== undefined && currentOptions 
    ? currentOptions.mapping.indexOf(currentMcqAnswer)
    : undefined;

  const questionText = currentQuestion ? (
    language === 'ru' && currentQuestion.question_text_ru ? currentQuestion.question_text_ru :
    language === 'en' && currentQuestion.question_text_en ? currentQuestion.question_text_en :
    currentQuestion.question_text_uz
  ) : '';

  const mcqCount = questions.filter(q => q.question_type === 'single_choice').length;
  const writtenCount = questions.filter(q => q.question_type === 'written').length;
  const answeredMcq = Object.keys(mcqAnswers).length;
  const answeredWritten = Object.keys(writtenAnswers).filter(
    k => writtenAnswers[k]?.answer_a?.trim() || writtenAnswers[k]?.answer_b?.trim()
  ).length;
  const totalAnswered = answeredMcq + answeredWritten;
  const progress = questions.length > 0 ? (totalAnswered / questions.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="test-container">
          <div className="flex h-14 items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Badge variant={timeLeft < 60 ? 'destructive' : 'secondary'} className="font-mono text-sm sm:text-base px-2 sm:px-3 py-1">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                {formatTime(timeLeft)}
              </Badge>
              {test?.test_format === 'milliy_sertifikat' && (
                <Badge variant="outline" className="hidden sm:flex">
                  Milliy Sertifikat
                </Badge>
              )}
            </div>
            
            {/* Mobile progress */}
            <div className="flex-1 mx-2 sm:hidden">
              <Progress value={progress} className="h-1.5" />
            </div>
            <div className="flex-1 max-w-xs hidden sm:block">
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden sm:inline-flex">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => handleFinish(false)}
                variant="destructive"
                size="sm"
                className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3"
              >
                <Flag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t('finish')}</span>
                <span className="sm:hidden">Tugatish</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Question navigation */}
      <div className="border-b bg-card/50">
        <div className="test-container py-3">
          <QuestionNavigator
            questions={questions}
            currentIndex={currentIndex}
            mcqAnswers={mcqAnswers}
            writtenAnswers={writtenAnswers}
            onNavigate={setCurrentIndex}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 py-3 sm:py-6">
        <div className="test-container px-3 sm:px-4">
          {currentQuestion && (
            <Card className="shadow-card animate-fade-in">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="font-medium">
                    {t('question')} {currentIndex + 1} {t('of')} {questions.length}
                  </Badge>
                  {currentQuestion.question_type === 'single_choice' ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckSquare className="h-3 w-3" />
                      {currentQuestion.points} ball
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-1 bg-accent text-accent-foreground">
                      <PenLine className="h-3 w-3" />
                      0-{currentQuestion.max_points || 3.2} ball
                    </Badge>
                  )}
                </div>
                
                {currentQuestion.image_url && (
                  <div className="mb-6 rounded-lg overflow-hidden border">
                    <img 
                      src={currentQuestion.image_url} 
                      alt="Question" 
                      className="max-h-64 w-auto mx-auto"
                    />
                  </div>
                )}
                
                <div className="text-base sm:text-lg font-medium mb-4 sm:mb-6 whitespace-pre-wrap">
                  <LatexRenderer text={questionText} />
                </div>
                
                {/* MCQ Options */}
                {currentQuestion.question_type === 'single_choice' && currentOptions && (
                  <div className="space-y-2 sm:space-y-3">
                    {currentOptions.options.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectOption(currentQuestion.id, i)}
                        className={`
                          w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all text-sm sm:text-base
                          ${currentDisplayAnswer === i 
                            ? 'border-primary bg-primary/5 shadow-soft' 
                            : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                          }
                        `}
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted font-semibold mr-2 sm:mr-3 text-sm">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <LatexRenderer text={String(option)} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Written Question Input */}
                {currentQuestion.question_type === 'written' && (
                  <WrittenQuestionInput
                    questionId={currentQuestion.id}
                    question={currentQuestion}
                    answer={writtenAnswers[currentQuestion.id]}
                    onChange={handleWrittenAnswerChange}
                    language={language}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-4 sm:mt-6 pb-4">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="gap-1 sm:gap-2 text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('previous')}</span>
              <span className="sm:hidden">Oldingi</span>
            </Button>
            
            {currentIndex < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="gap-1 sm:gap-2 gradient-primary border-0 text-sm"
              >
                <span className="hidden sm:inline">{t('next')}</span>
                <span className="sm:hidden">Keyingi</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => handleFinish(false)}
                variant="destructive"
                className="gap-1 sm:gap-2 text-sm"
              >
                <Flag className="h-4 w-4" />
                {t('finish')}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Finish confirmation dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('finish')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmFinish')}
              <br />
              <span className="font-medium">
                Test savollari: {answeredMcq}/{mcqCount} ta javob berildi
              </span>
              {writtenCount > 0 && (
                <>
                  <br />
                  <span className="font-medium">
                    Yozma savollar: {answeredWritten}/{writtenCount} ta javob berildi
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleFinish(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('finish')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TestInterface() {
  return (
    <LanguageProvider>
      <TestInterfaceContent />
    </LanguageProvider>
  );
}
