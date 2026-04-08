
-- Create enum for test visibility
CREATE TYPE public.test_visibility AS ENUM ('public', 'private');

-- Create enum for question type
CREATE TYPE public.question_type AS ENUM ('single_choice', 'written');

-- Create enum for attempt status
CREATE TYPE public.attempt_status AS ENUM ('in_progress', 'finished');

-- Create admin roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Create subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_uz TEXT NOT NULL,
    name_ru TEXT,
    name_en TEXT,
    name_qq TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are viewable by everyone" ON public.subjects FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create tests table
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_uz TEXT NOT NULL,
    title_ru TEXT,
    title_en TEXT,
    description_uz TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    visibility test_visibility NOT NULL DEFAULT 'public',
    test_code TEXT UNIQUE,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    allow_retry BOOLEAN NOT NULL DEFAULT false,
    randomize_questions BOOLEAN NOT NULL DEFAULT true,
    randomize_options BOOLEAN NOT NULL DEFAULT true,
    negative_marking BOOLEAN NOT NULL DEFAULT false,
    test_format TEXT DEFAULT 'standard',
    scheduled_start TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public tests are viewable by everyone" ON public.tests FOR SELECT TO authenticated, anon USING (visibility = 'public' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Private tests viewable with code" ON public.tests FOR SELECT TO authenticated, anon USING (visibility = 'private');
CREATE POLICY "Admins can manage tests" ON public.tests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    question_text_uz TEXT NOT NULL,
    question_text_ru TEXT,
    question_text_en TEXT,
    image_url TEXT,
    question_type question_type NOT NULL DEFAULT 'single_choice',
    options JSONB NOT NULL DEFAULT '[]',
    correct_option INTEGER NOT NULL,
    points NUMERIC(5,2) NOT NULL DEFAULT 1,
    max_points NUMERIC(5,2) DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    model_answer_uz TEXT,
    model_answer_ru TEXT,
    model_answer_en TEXT,
    rubric_uz TEXT,
    rubric_ru TEXT,
    condition_a_uz TEXT,
    condition_a_ru TEXT,
    condition_b_uz TEXT,
    condition_b_ru TEXT,
    points_a NUMERIC(5,2),
    points_b NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions viewable for accessible tests" ON public.questions FOR SELECT TO authenticated, anon USING (EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id));
CREATE POLICY "Admins can manage questions" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create test_participants table
CREATE TABLE public.test_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.test_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can be created by anyone" ON public.test_participants FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Participants viewable by admins" ON public.test_participants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants can view themselves" ON public.test_participants FOR SELECT TO anon USING (true);

-- Create test_attempts table
CREATE TABLE public.test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    participant_id TEXT REFERENCES public.test_participants(participant_id) ON DELETE CASCADE NOT NULL,
    status attempt_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    score NUMERIC(8,2) DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    answers JSONB NOT NULL DEFAULT '{}',
    written_answers JSONB DEFAULT '{}'::jsonb,
    ai_evaluation JSONB DEFAULT '{}'::jsonb,
    mcq_score NUMERIC(8,2) DEFAULT 0,
    written_score NUMERIC(5,2) DEFAULT 0,
    evaluation_status TEXT DEFAULT 'pending'
);
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create attempts" ON public.test_attempts FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Anyone can update their attempt" ON public.test_attempts FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "Attempts viewable by participant or admin" ON public.test_attempts FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_test_attempts_evaluation_status ON public.test_attempts(evaluation_status);

-- Helper functions
CREATE OR REPLACE FUNCTION public.generate_participant_id()
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; result TEXT := ''; i INTEGER;
BEGIN FOR i IN 1..8 LOOP result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1); END LOOP; RETURN result; END; $$;

CREATE OR REPLACE FUNCTION public.generate_test_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE result TEXT := ''; i INTEGER;
BEGIN FOR i IN 1..5 LOOP result := result || floor(random() * 10)::integer::text; END LOOP; RETURN result; END; $$;

CREATE OR REPLACE FUNCTION public.set_test_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN IF NEW.visibility = 'private' AND NEW.test_code IS NULL THEN NEW.test_code := public.generate_test_code(); END IF; RETURN NEW; END; $$;

CREATE TRIGGER trigger_set_test_code BEFORE INSERT ON public.tests FOR EACH ROW EXECUTE FUNCTION public.set_test_code();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Secure view for public questions (excludes correct answers)
CREATE OR REPLACE FUNCTION public.get_public_questions(p_test_id UUID)
RETURNS TABLE (
  id UUID, test_id UUID, question_type question_type, options JSONB,
  points NUMERIC, order_index INTEGER, created_at TIMESTAMPTZ,
  max_points NUMERIC, question_text_uz TEXT, question_text_ru TEXT,
  question_text_en TEXT, image_url TEXT,
  condition_a_uz TEXT, condition_a_ru TEXT,
  condition_b_uz TEXT, condition_b_ru TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.test_id, q.question_type, q.options,
    q.points, q.order_index, q.created_at, q.max_points,
    q.question_text_uz, q.question_text_ru, q.question_text_en, q.image_url,
    q.condition_a_uz, q.condition_a_ru, q.condition_b_uz, q.condition_b_ru
  FROM public.questions q WHERE q.test_id = p_test_id ORDER BY q.order_index;
$$;

-- Insert default subjects
INSERT INTO public.subjects (name_uz, name_ru, name_en) VALUES
('Matematika', 'Математика', 'Mathematics'),
('Fizika', 'Физика', 'Physics'),
('Kimyo', 'Химия', 'Chemistry'),
('Biologiya', 'Биология', 'Biology'),
('Ingliz tili', 'Английский язык', 'English'),
('Tarix', 'История', 'History'),
('Ona tili va adabiyot', 'Родной язык и литература', 'Uzbek Language and Literature'),
('Informatika', 'Информатика', 'Computer Science');
