import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WrittenAnswer, Question } from '@/types/test';
import LatexRenderer from '@/components/ui/LatexRenderer';

interface WrittenQuestionInputProps {
  questionId: string;
  question: Question;
  answer: WrittenAnswer | undefined;
  onChange: (questionId: string, answer: WrittenAnswer) => void;
  disabled?: boolean;
  language: string;
}

export function WrittenQuestionInput({ 
  questionId, 
  question,
  answer, 
  onChange,
  disabled = false,
  language
}: WrittenQuestionInputProps) {
  const currentAnswer: WrittenAnswer = answer || { answer_a: '', answer_b: '' };

  const conditionA = language === 'ru' && question.condition_a_ru 
    ? question.condition_a_ru 
    : question.condition_a_uz;
  
  const conditionB = language === 'ru' && question.condition_b_ru 
    ? question.condition_b_ru 
    : question.condition_b_uz;

  const handleChange = (field: 'answer_a' | 'answer_b', value: string) => {
    onChange(questionId, {
      ...currentAnswer,
      [field]: value
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${questionId}-a`} className="text-base font-medium">
            a-shart
          </Label>
          <Badge variant="outline" className="text-xs">Condition A</Badge>
        </div>
        {conditionA && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm font-medium whitespace-pre-wrap">
            <LatexRenderer text={conditionA} />
          </div>
        )}
        <Textarea
          id={`${questionId}-a`}
          value={currentAnswer.answer_a}
          onChange={(e) => handleChange('answer_a', e.target.value)}
          placeholder="a-shart bo'yicha javobingizni yozing..."
          rows={4}
          disabled={disabled}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {currentAnswer.answer_a.length} / 2000 belgi
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${questionId}-b`} className="text-base font-medium">
            b-shart
          </Label>
          <Badge variant="outline" className="text-xs">Condition B</Badge>
        </div>
        {conditionB && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm font-medium whitespace-pre-wrap">
            <LatexRenderer text={conditionB} />
          </div>
        )}
        <Textarea
          id={`${questionId}-b`}
          value={currentAnswer.answer_b}
          onChange={(e) => handleChange('answer_b', e.target.value)}
          placeholder="b-shart bo'yicha javobingizni yozing..."
          rows={4}
          disabled={disabled}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {currentAnswer.answer_b.length} / 2000 belgi
        </p>
      </div>
    </div>
  );
}
