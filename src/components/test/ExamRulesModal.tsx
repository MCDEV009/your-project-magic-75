import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Monitor, RefreshCcw, CheckCircle2 } from 'lucide-react';

interface ExamRulesModalProps {
  open: boolean;
  onAccept: () => void;
  testTitle: string;
  duration: number;
  questionCount: number;
  isMilliySertifikat?: boolean;
}

export function ExamRulesModal({
  open,
  onAccept,
  testTitle,
  duration,
  questionCount,
  isMilliySertifikat = false
}: ExamRulesModalProps) {
  const { language } = useLanguage();
  const [agreed, setAgreed] = useState(false);

  const rules = language === 'ru' ? {
    title: 'Правила экзамена',
    description: 'Пожалуйста, внимательно прочитайте правила перед началом теста',
    rules: [
      { icon: Clock, text: `Время теста: ${duration} минут. Таймер начнется сразу после нажатия "Начать"` },
      { icon: Monitor, text: 'Не покидайте страницу теста и не переключайте вкладки' },
      { icon: RefreshCcw, text: 'Ваши ответы сохраняются автоматически каждые 5 секунд' },
      { icon: AlertTriangle, text: 'По истечении времени тест будет отправлен автоматически' },
      ...(isMilliySertifikat ? [
        { icon: CheckCircle2, text: 'Вопросы 1-35: тестовые (1 балл каждый). Вопросы 36-45: письменные (0-2 балла каждый)' }
      ] : [])
    ],
    agree: 'Я прочитал(а) и принимаю правила',
    start: 'Начать тест',
    cancel: 'Отмена'
  } : language === 'en' ? {
    title: 'Exam Rules',
    description: 'Please read the rules carefully before starting the test',
    rules: [
      { icon: Clock, text: `Test duration: ${duration} minutes. Timer starts immediately after clicking "Start"` },
      { icon: Monitor, text: 'Do not leave the test page or switch browser tabs' },
      { icon: RefreshCcw, text: 'Your answers are automatically saved every 5 seconds' },
      { icon: AlertTriangle, text: 'When time expires, the test will be submitted automatically' },
      ...(isMilliySertifikat ? [
        { icon: CheckCircle2, text: 'Questions 1-35: Multiple choice (1 point each). Questions 36-45: Written (0-2 points each)' }
      ] : [])
    ],
    agree: 'I have read and accept the rules',
    start: 'Start Test',
    cancel: 'Cancel'
  } : {
    title: 'Imtihon qoidalari',
    description: 'Iltimos, testni boshlashdan oldin qoidalarni diqqat bilan o\'qing',
    rules: [
      { icon: Clock, text: `Test davomiyligi: ${duration} daqiqa. Taymer "Boshlash" tugmasini bosgandan keyin darhol boshlanadi` },
      { icon: Monitor, text: 'Test sahifasidan chiqmang va brauzer oynalarini almashtirib turmang' },
      { icon: RefreshCcw, text: 'Javoblaringiz har 5 soniyada avtomatik saqlanadi' },
      { icon: AlertTriangle, text: 'Vaqt tugaganda test avtomatik topshiriladi' },
      ...(isMilliySertifikat ? [
        { icon: CheckCircle2, text: '1-35 savollar: test (har biri 1 ball). 36-45 savollar: yozma (har biri 0-2 ball)' }
      ] : [])
    ],
    agree: 'Qoidalarni o\'qidim va qabul qilaman',
    start: 'Testni boshlash',
    cancel: 'Bekor qilish'
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {rules.title}
          </DialogTitle>
          <DialogDescription>{rules.description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <h3 className="font-semibold text-lg mb-1">{testTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {questionCount} {language === 'ru' ? 'вопросов' : language === 'en' ? 'questions' : 'savol'} • {duration} {language === 'ru' ? 'минут' : language === 'en' ? 'minutes' : 'daqiqa'}
            </p>
          </div>

          <ScrollArea className="h-48 pr-4">
            <ul className="space-y-4">
              {rules.rules.map((rule, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <rule.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm leading-relaxed pt-1">{rule.text}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox 
            id="agree" 
            checked={agreed} 
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
          />
          <Label 
            htmlFor="agree" 
            className="text-sm cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {rules.agree}
          </Label>
        </div>

        <DialogFooter>
          <Button
            onClick={onAccept}
            disabled={!agreed}
            className="w-full gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"
          >
            {rules.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
