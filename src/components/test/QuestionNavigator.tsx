import { Question, WrittenAnswer } from '@/types/test';
import { cn } from '@/lib/utils';

interface QuestionNavigatorProps {
  questions: Question[];
  currentIndex: number;
  mcqAnswers: Record<string, number>;
  writtenAnswers: Record<string, WrittenAnswer>;
  onNavigate: (index: number) => void;
}

export function QuestionNavigator({
  questions,
  currentIndex,
  mcqAnswers,
  writtenAnswers,
  onNavigate
}: QuestionNavigatorProps) {
  const allMcq = questions.filter(q => q.question_type === 'single_choice');
  const writtenQuestions = questions.filter(q => q.question_type === 'written');
  // BMBA blueprint: oxirgi 3 ta yopiq savol — moslashtirish bloki (Blok 2)
  const hasMatchingBlock = allMcq.length >= 35;
  const mcqQuestions = hasMatchingBlock ? allMcq.slice(0, allMcq.length - 3) : allMcq;
  const matchingQuestions = hasMatchingBlock ? allMcq.slice(allMcq.length - 3) : [];

  const isAnswered = (question: Question) => {
    if (question.question_type === 'single_choice') {
      return mcqAnswers[question.id] !== undefined;
    } else {
      const answer = writtenAnswers[question.id];
      return answer && (answer.answer_a?.trim() || answer.answer_b?.trim());
    }
  };

  const getQuestionIndex = (question: Question) => {
    return questions.findIndex(q => q.id === question.id);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* MCQ Questions (1-35) */}
      {mcqQuestions.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            Blok 1: Yopiq testlar (1-{mcqQuestions.length})
          </p>
          <div className="flex gap-1 sm:gap-1.5 flex-wrap">
            {mcqQuestions.map((q, i) => {
              const globalIndex = getQuestionIndex(q);
              return (
                <button
                  key={q.id}
                  onClick={() => onNavigate(globalIndex)}
                  className={cn(
                    "shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all",
                    globalIndex === currentIndex 
                      ? "gradient-primary text-primary-foreground shadow-soft" 
                      : isAnswered(q)
                        ? "bg-success/20 text-success border border-success/30"
                        : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Matching block */}
      {matchingQuestions.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            Blok 2: Moslashtirish ({mcqQuestions.length + 1}-{allMcq.length})
          </p>
          <div className="flex gap-1 sm:gap-1.5 flex-wrap">
            {matchingQuestions.map((q, i) => {
              const globalIndex = getQuestionIndex(q);
              return (
                <button
                  key={q.id}
                  onClick={() => onNavigate(globalIndex)}
                  className={cn(
                    "shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all border",
                    globalIndex === currentIndex
                      ? "gradient-primary text-primary-foreground shadow-soft border-transparent"
                      : isAnswered(q)
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-muted hover:bg-muted/80 border-primary/20"
                  )}
                >
                  {mcqQuestions.length + i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Written Questions (36-45) */}
      {writtenQuestions.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            Blok 3: Ochiq / Yozma savollar ({allMcq.length + 1}-{questions.length})
          </p>
          <div className="flex gap-1 sm:gap-1.5 flex-wrap">
            {writtenQuestions.map((q, i) => {
              const globalIndex = getQuestionIndex(q);
              return (
                <button
                  key={q.id}
                  onClick={() => onNavigate(globalIndex)}
                  className={cn(
                    "shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all border-2",
                    globalIndex === currentIndex 
                      ? "gradient-accent text-accent-foreground shadow-soft" 
                      : isAnswered(q)
                        ? "bg-accent/20 text-accent border-accent/30"
                        : "bg-muted hover:bg-muted/80 border-transparent"
                  )}
                >
                  {allMcq.length + i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
