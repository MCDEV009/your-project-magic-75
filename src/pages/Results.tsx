import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Question, TestAttempt, Test, WrittenAnswer, EvaluationResult } from '@/types/test';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { WrittenQuestionReview } from '@/components/results/WrittenQuestionReview';
import { AIAnalysis } from '@/components/results/AIAnalysis';
import { AlXorazmiyChat } from '@/components/results/AlXorazmiyChat';
import { QuestionStatsList } from '@/components/results/QuestionStatsList';
import { Trophy, CheckCircle, XCircle, Home, RotateCcw, ChevronDown, ChevronUp, Loader2, PenLine, CheckSquare } from 'lucide-react';

function ResultsContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Poll for evaluation status
  useEffect(() => {
    if (!attempt || attempt.evaluation_status === 'completed') return;
    
    const interval = setInterval(async () => {
      const { data } = await supabase
        .rpc('get_attempt_status', { p_attempt_id: attemptId })
        .single();
      
      if (data) {
        setAttempt(prev => prev ? { ...prev, ...data } as TestAttempt : null);
        if (data.evaluation_status === 'completed') {
          clearInterval(interval);
        }
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [attempt?.evaluation_status, attemptId]);

  useEffect(() => {
    async function fetchData() {
      if (!attemptId) return;
      
      const { data: attemptData, error } = await supabase
        .rpc('get_test_attempt_by_id', { p_attempt_id: attemptId })
        .single();
      
      if (error || !attemptData) {
        navigate('/');
        return;
      }
      
      setAttempt(attemptData as TestAttempt);
      
      const { data: testData } = await supabase
        .from('tests')
        .select('*')
        .eq('id', attemptData.test_id)
        .single();
      
      if (testData) {
        setTest(testData as Test);
      }
      
      const { data: questionsData } = await supabase
        .rpc('get_public_questions', { p_test_id: attemptData.test_id });
      
      if (questionsData) {
        setQuestions(questionsData as unknown as Question[]);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [attemptId, navigate]);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedQuestions(new Set(questions.map(q => q.id)));
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  if (!attempt || !test) {
    return null;
  }

  const mcqQuestions = questions.filter(q => q.question_type === 'single_choice');
  const writtenQuestions = questions.filter(q => q.question_type === 'written');
  
  const mcqScore = attempt.mcq_score || 0;
  const writtenScore = attempt.written_score || 0;
  const totalMcqPoints = mcqQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
  const totalWrittenPoints = writtenQuestions.reduce((sum, q) => sum + (q.max_points || 3.2), 0);
  const totalScore = mcqScore + writtenScore;
  const totalPoints = totalMcqPoints + totalWrittenPoints;
  
  const percentage = totalPoints > 0 
    ? Math.round((totalScore / totalPoints) * 100) 
    : 0;

  const title = language === 'ru' && test.title_ru ? test.title_ru :
                language === 'en' && test.title_en ? test.title_en : test.title_uz;

  const answers = (attempt.answers || {}) as Record<string, number>;
  const writtenAnswers = (attempt.written_answers || {}) as Record<string, WrittenAnswer>;
  const aiEvaluation = (attempt.ai_evaluation || {}) as Record<string, EvaluationResult>;
  const raschData = (aiEvaluation as any)['_rasch'] as { theta: number; t_score: number; total_attempts_analyzed: number } | undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-4 sm:py-8">
        <div className="test-container px-3 sm:px-4">
          {/* Score card */}
          <Card className="shadow-elevated mb-8 overflow-hidden">
            <div className={`p-1 ${percentage >= 60 ? 'gradient-accent' : 'bg-destructive'}`} />
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Trophy className={`h-10 w-10 ${percentage >= 60 ? 'text-accent' : 'text-destructive'}`} />
              </div>
              <CardTitle className="text-2xl">{t('testFinished')}</CardTitle>
              <p className="text-muted-foreground">{title}</p>
              {test.test_format === 'milliy_sertifikat' && (
                <Badge variant="outline" className="mx-auto mt-2">Milliy Sertifikat</Badge>
              )}
            </CardHeader>
            <CardContent className="text-center space-y-6">
              {/* Score breakdown */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Test savollari</span>
                  </div>
                  <div className="text-2xl font-bold">{Number(mcqScore).toFixed(1)}/{totalMcqPoints.toFixed(1)}</div>
                </div>
                
                {writtenQuestions.length > 0 && (
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <PenLine className="h-4 w-4 text-accent" />
                      <span className="text-sm text-muted-foreground">Yozma savollar</span>
                    </div>
                    {attempt.evaluation_status === 'completed' ? (
                      <div className="text-2xl font-bold">{writtenScore.toFixed(1)}/{totalWrittenPoints}</div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Baholanmoqda...</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Umumiy ball</div>
                  <div className="text-3xl font-bold">{percentage}%</div>
                </div>
              </div>

              {/* Rasch Model T-Score */}
              {raschData && (
                <div className="p-3 sm:p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">Rasch modeli natijalari</div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">Qobiliyat (θ)</div>
                      <div className="text-lg sm:text-xl font-bold text-primary">{raschData.theta}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">T-ball</div>
                      <div className="text-lg sm:text-xl font-bold text-primary">{raschData.t_score}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Urinishlar</div>
                      <div className="text-lg sm:text-xl font-bold">{raschData.total_attempts_analyzed}</div>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
                    T = 50 + 10 × Z, Z = (θ - μ) / σ
                  </p>
                </div>
              )}
              
              <Progress 
                value={percentage} 
                className={`h-3 ${percentage >= 60 ? '' : '[&>div]:bg-destructive'}`}
              />
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button 
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  {t('backToHome')}
                </Button>
                {test.allow_retry && (
                  <Button 
                    onClick={() => navigate(`/enter/${test.id}`)}
                    className="gap-2 gradient-primary border-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('retakeTest')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {attempt.evaluation_status === 'completed' && (
            <>
              <div className="mb-8">
                <AIAnalysis attemptId={attemptId!} />
              </div>
              <div className="mb-8">
                <QuestionStatsList attemptId={attemptId!} />
              </div>
              <div className="mb-8">
                <AlXorazmiyChat attemptId={attemptId!} />
              </div>
            </>
          )}

          {/* MCQ Question review */}
          {mcqQuestions.length > 0 && (
            <div className="space-y-4 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Test savollari ({mcqQuestions.length})
                </h2>
                <div className="flex gap-1 sm:gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs sm:text-sm">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Barchasini ochish</span>
                    <span className="sm:hidden">Ochish</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs sm:text-sm">
                    <ChevronUp className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Barchasini yopish</span>
                    <span className="sm:hidden">Yopish</span>
                  </Button>
                </div>
              </div>
              
              {mcqQuestions.map((question, index) => {
                const userAnswer = answers[question.id];
                const mcqResult = aiEvaluation[question.id] as any;
                const isCorrect = mcqResult?.is_correct ?? false;
                const isExpanded = expandedQuestions.has(question.id);
                const options = question.options as string[];
                
                const questionText = language === 'ru' && question.question_text_ru ? question.question_text_ru :
                                     language === 'en' && question.question_text_en ? question.question_text_en :
                                     question.question_text_uz;

                return (
                  <Card 
                    key={question.id} 
                    className={`overflow-hidden transition-all ${isCorrect ? 'border-success/30' : 'border-destructive/30'}`}
                  >
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className={`
                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                        ${isCorrect ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}
                      `}>
                        {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">#{index + 1}</Badge>
                          <span className="truncate font-medium">{questionText}</span>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {isCorrect ? (question.points || 1) : 0}/{question.points || 1} ball
                          </Badge>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4 space-y-3 animate-fade-in">
                        {question.image_url && (
                          <img 
                            src={question.image_url} 
                            alt="Question" 
                            className="max-h-48 rounded-lg border"
                          />
                        )}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{questionText}</p>
                        
                        <div className="space-y-2">
                          {options.map((option, i) => {
                            const isUserAnswer = userAnswer === i;
                            const isCorrectAnswer = mcqResult?.correct_option === i;
                            
                            return (
                              <div
                                key={i}
                                className={`
                                  p-3 rounded-lg border-2 text-sm
                                  ${isCorrectAnswer 
                                    ? 'border-success bg-success/10' 
                                    : isUserAnswer && !isCorrectAnswer
                                      ? 'border-destructive bg-destructive/10'
                                      : 'border-muted'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className="flex-1">{option}</span>
                                  {isCorrectAnswer && <Badge variant="secondary" className="bg-success/20 text-success">{t('correctAnswer')}</Badge>}
                                  {isUserAnswer && !isCorrectAnswer && <Badge variant="secondary" className="bg-destructive/20 text-destructive">{t('yourAnswer')}</Badge>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Written Questions Review */}
          {writtenQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Yozma savollar ({writtenQuestions.length})
                {attempt.evaluation_status !== 'completed' && (
                  <Badge variant="outline" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI baholanmoqda
                  </Badge>
                )}
              </h2>
              
              {writtenQuestions.map((question, index) => (
                <WrittenQuestionReview
                  key={question.id}
                  question={question}
                  questionNumber={mcqQuestions.length + index + 1}
                  answer={writtenAnswers[question.id]}
                  evaluation={aiEvaluation[question.id]}
                  evaluationStatus={attempt.evaluation_status as 'pending' | 'evaluating' | 'completed'}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Results() {
  return (
    <LanguageProvider>
      <ResultsContent />
    </LanguageProvider>
  );
}
