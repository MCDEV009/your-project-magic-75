import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { QuestionImageInput } from '@/components/admin/QuestionImageInput';

interface WrittenQuestionFormData {
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

interface WrittenQuestionFormProps {
  form: WrittenQuestionFormData;
  onChange: (updates: Partial<WrittenQuestionFormData>) => void;
}

export function WrittenQuestionForm({ form, onChange }: WrittenQuestionFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Badge className="bg-accent text-accent-foreground">Yozma savol</Badge>
        <span className="text-sm text-muted-foreground">
          Milliy Sertifikat formati: Masala + a-shart + b-shart
        </span>
      </div>

      {/* Main Question/Problem Text */}
      <div className="space-y-2">
        <Label>Masala matni (O'zbekcha) *</Label>
        <Textarea
          value={form.question_text_uz}
          onChange={(e) => onChange({ question_text_uz: e.target.value })}
          placeholder="Asosiy masala matnini kiriting..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Bu asosiy masala/stsenariy matni. O'quvchi avval buni o'qiydi.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Masala matni (Ruscha)</Label>
        <Textarea
          value={form.question_text_ru}
          onChange={(e) => onChange({ question_text_ru: e.target.value })}
          placeholder="Текст задачи..."
          rows={2}
        />
      </div>

      {/* Condition A */}
      <div className="p-4 rounded-lg border border-dashed space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">a-shart</Badge>
          <span className="text-sm text-muted-foreground">Birinchi topshiriq</span>
        </div>
        <div className="space-y-2">
          <Label>a-shart (O'zbekcha) *</Label>
          <Textarea
            value={form.condition_a_uz}
            onChange={(e) => onChange({ condition_a_uz: e.target.value })}
            placeholder="Birinchi shartni kiriting..."
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>a-shart (Ruscha)</Label>
          <Textarea
            value={form.condition_a_ru}
            onChange={(e) => onChange({ condition_a_ru: e.target.value })}
            placeholder="Условие А..."
            rows={2}
          />
        </div>
      </div>

      {/* Condition B */}
      <div className="p-4 rounded-lg border border-dashed space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">b-shart</Badge>
          <span className="text-sm text-muted-foreground">Ikkinchi topshiriq</span>
        </div>
        <div className="space-y-2">
          <Label>b-shart (O'zbekcha) *</Label>
          <Textarea
            value={form.condition_b_uz}
            onChange={(e) => onChange({ condition_b_uz: e.target.value })}
            placeholder="Ikkinchi shartni kiriting..."
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>b-shart (Ruscha)</Label>
          <Textarea
            value={form.condition_b_ru}
            onChange={(e) => onChange({ condition_b_ru: e.target.value })}
            placeholder="Условие Б..."
            rows={2}
          />
        </div>
      </div>

      {/* Image upload or URL */}
      <QuestionImageInput
        value={form.image_url}
        onChange={(url) => onChange({ image_url: url })}
      />

      {/* Model Answer */}
      <div className="space-y-2">
        <Label>Namunaviy javob (O'zbekcha) *</Label>
        <Textarea
          value={form.model_answer_uz}
          onChange={(e) => onChange({ model_answer_uz: e.target.value })}
          placeholder="a-shart va b-shart uchun to'g'ri javoblarni yozing..."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          AI baholash uchun to'g'ri javob namunasi. Har ikkala shart uchun javobni yozing.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Namunaviy javob (Ruscha)</Label>
        <Textarea
          value={form.model_answer_ru}
          onChange={(e) => onChange({ model_answer_ru: e.target.value })}
          placeholder="Образец правильного ответа..."
          rows={3}
        />
      </div>

      {/* Rubric */}
      <div className="space-y-2">
        <Label>Baholash mezonlari (O'zbekcha)</Label>
        <Textarea
          value={form.rubric_uz}
          onChange={(e) => onChange({ rubric_uz: e.target.value })}
          placeholder="Qanday hollarda to'liq ball beriladi, qanday hollarda qisman..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Baholash mezonlari (Ruscha)</Label>
        <Textarea
          value={form.rubric_ru}
          onChange={(e) => onChange({ rubric_ru: e.target.value })}
          placeholder="Критерии оценивания..."
          rows={2}
        />
      </div>

      {/* Points info */}
      <p className="text-xs text-muted-foreground">
        ✨ Ball AI tomonidan avtomatik belgilanadi. Standart: a-shart = 1.5, b-shart = 1.7, jami = 3.2
      </p>
    </div>
  );
}
