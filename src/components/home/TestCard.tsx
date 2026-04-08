import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { Test } from '@/types/test';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, FileQuestion, ArrowRight } from 'lucide-react';

interface TestCardProps {
  test: Test;
  questionCount?: number;
}

export function TestCard({ test, questionCount = 0 }: TestCardProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStartTest = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/enter/${test.id}`);
  };

  const title = language === 'ru' && test.title_ru ? test.title_ru :
                language === 'en' && test.title_en ? test.title_en : test.title_uz;

  const subjectName = test.subjects ? (
    language === 'ru' && test.subjects.name_ru ? test.subjects.name_ru :
    language === 'en' && test.subjects.name_en ? test.subjects.name_en : test.subjects.name_uz
  ) : null;

  return (
    <Card className="group shadow-card hover:shadow-elevated transition-all duration-300 border-transparent hover:border-primary/20 overflow-hidden">
      <div className="absolute inset-0 gradient-primary opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
      <CardHeader className="pb-3">
        {subjectName && (
          <Badge variant="secondary" className="w-fit mb-2">
            {subjectName}
          </Badge>
        )}
        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{test.duration_minutes} {t('minutes')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileQuestion className="h-4 w-4" />
            <span>{questionCount} {t('questions')}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleStartTest}
          className="w-full gradient-primary border-0 shadow-soft group-hover:shadow-glow transition-shadow"
        >
          {t('startTest')}
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
}
