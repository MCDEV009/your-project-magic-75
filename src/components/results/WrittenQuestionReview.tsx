import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Question, WrittenAnswer, EvaluationResult } from '@/types/test';
import { CheckCircle, AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import LatexRenderer from '@/components/ui/LatexRenderer';

interface WrittenQuestionReviewProps {
  question: Question;
  questionNumber: number;
  answer: WrittenAnswer | undefined;
  evaluation: EvaluationResult | undefined;
  evaluationStatus: 'pending' | 'evaluating' | 'completed';
  language: string;
}

export function WrittenQuestionReview({
  question,
  questionNumber,
  answer,
  evaluation,
  evaluationStatus,
  language
}: WrittenQuestionReviewProps) {
  const questionText = language === 'ru' && question.question_text_ru 
    ? question.question_text_ru 
    : question.question_text_uz;

  const conditionA = language === 'ru' && question.condition_a_ru 
    ? question.condition_a_ru 
    : question.condition_a_uz;
  
  const conditionB = language === 'ru' && question.condition_b_ru 
    ? question.condition_b_ru 
    : question.condition_b_uz;

  const feedback = evaluation 
    ? (language === 'ru' ? evaluation.feedback_ru : evaluation.feedback_uz)
    : null;

  const maxPoints = question.max_points || 3.2;
  const evalAny = evaluation as any;
  const scoreA = evalAny?.score_a;
  const scoreB = evalAny?.score_b;
  const maxPointsA = evalAny?.max_points_a || 1.5;
  const maxPointsB = evalAny?.max_points_b || 1.7;
  const scorePercentage = evaluation ? (evaluation.score / maxPoints) * 100 : 0;

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 75) return 'text-success';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-accent text-accent">
              #{questionNumber}
            </Badge>
            <Badge variant="secondary">Yozma savol</Badge>
          </div>
          
          {evaluationStatus === 'completed' && evaluation ? (
            <div className="text-right">
              <div className={`flex items-center gap-2 ${getScoreColor(evaluation.score, maxPoints)}`}>
                <span className="text-2xl font-bold">{evaluation.score.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/ {maxPoints.toFixed(1)}</span>
              </div>
              {scoreA !== undefined && scoreB !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  a: {scoreA.toFixed(1)}/{maxPointsA} | b: {scoreB.toFixed(1)}/{maxPointsB}
                </div>
              )}
            </div>
          ) : evaluationStatus === 'evaluating' ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Baholanmoqda...</span>
            </div>
          ) : (
            <Badge variant="outline">Kutilmoqda</Badge>
          )}
        </div>

        {/* Question (Masala) */}
        <div>
          {question.image_url && (
            <img 
              src={question.image_url} 
              alt="Question" 
              className="max-h-48 rounded-lg border mb-3"
            />
          )}
          <p className="font-medium whitespace-pre-wrap">
            <LatexRenderer text={questionText} />
          </p>
        </div>

        {/* Student Answers with Conditions */}
        <div className="space-y-3 bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground">Sizning javoblaringiz:</p>
          
          {answer ? (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium">a-shart:</p>
                {conditionA && (
                  <div className="text-sm p-2 rounded bg-muted border-l-2 border-primary mb-1">
                    <LatexRenderer text={conditionA} />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap bg-background rounded p-2 border">
                  {answer.answer_a || <span className="text-muted-foreground italic">Bo'sh</span>}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">b-shart:</p>
                {conditionB && (
                  <div className="text-sm p-2 rounded bg-muted border-l-2 border-primary mb-1">
                    <LatexRenderer text={conditionB} />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap bg-background rounded p-2 border">
                  {answer.answer_b || <span className="text-muted-foreground italic">Bo'sh</span>}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Javob berilmagan</p>
          )}
        </div>

        {/* AI Evaluation */}
        {evaluationStatus === 'completed' && evaluation && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <p className="text-sm font-medium">AI Baholashi</p>
            </div>

            {/* Score Progress */}
            <div className="space-y-1">
              <Progress 
                value={scorePercentage} 
                className={`h-2 ${scorePercentage >= 75 ? '' : scorePercentage >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'}`}
              />
            </div>

            {/* Feedback */}
            <p className="text-sm">{feedback}</p>

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Kuchli tomonlar:
                </p>
                <ul className="text-sm list-disc list-inside text-muted-foreground">
                  {evaluation.strengths.map((strength, i) => (
                    <li key={i}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Points */}
            {evaluation.missing_points && evaluation.missing_points.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Yetishmayotgan jihatlar:
                </p>
                <ul className="text-sm list-disc list-inside text-muted-foreground">
                  {evaluation.missing_points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
