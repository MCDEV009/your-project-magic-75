export interface Test {
  id: string;
  title_uz: string;
  title_ru?: string;
  title_en?: string;
  description_uz?: string;
  subject_id?: string;
  visibility: 'public' | 'private';
  test_code?: string;
  duration_minutes: number;
  allow_retry: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  negative_marking: boolean;
  test_format: 'standard' | 'milliy_sertifikat';
  scheduled_start?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  subjects?: Subject;
}

export interface Subject {
  id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  name_qq?: string;
  enabled?: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  test_id: string;
  question_text_uz: string;
  question_text_ru?: string;
  question_text_en?: string;
  image_url?: string;
  question_type: 'single_choice' | 'written';
  options: string[];
  correct_option: number;
  points: number;
  max_points: number;
  order_index: number;
  model_answer_uz?: string;
  model_answer_ru?: string;
  model_answer_en?: string;
  rubric_uz?: string;
  rubric_ru?: string;
  condition_a_uz?: string;
  condition_a_ru?: string;
  condition_b_uz?: string;
  condition_b_ru?: string;
  created_at: string;
}

export interface WrittenAnswer {
  answer_a: string;
  answer_b: string;
}

export interface EvaluationResult {
  score: number;
  feedback_uz: string;
  feedback_ru: string;
  strengths: string[];
  missing_points: string[];
}

export interface TestParticipant {
  id: string;
  participant_id: string;
  full_name: string;
  created_at: string;
}

export interface TestAttempt {
  id: string;
  test_id: string;
  participant_id: string;
  status: 'in_progress' | 'finished';
  started_at: string;
  finished_at?: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  answers: Record<string, number> | any;
  written_answers: Record<string, WrittenAnswer> | any;
  ai_evaluation: Record<string, EvaluationResult> | any;
  mcq_score: number;
  written_score: number;
  evaluation_status: string;
}

export interface TestWithQuestions extends Test {
  questions: Question[];
}
