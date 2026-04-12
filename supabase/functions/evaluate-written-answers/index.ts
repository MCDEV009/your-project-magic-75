import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WrittenAnswer {
  answer_a: string;
  answer_b: string;
}

interface ModelAnswerData {
  answer_a: string;
  answer_b: string;
  keywords_a: string[];
  keywords_b: string[];
}

interface EvaluationResult {
  score: number;
  score_a: number;
  score_b: number;
  max_points_a: number;
  max_points_b: number;
  feedback_uz: string;
  feedback_ru: string;
  strengths: string[];
  missing_points: string[];
}

/**
 * Keyword-based scoring: compare student answer against model answer keywords.
 * Returns a score between 0 and maxPoints.
 */
function evaluateByKeywords(
  studentAnswer: string,
  modelAnswer: string,
  keywords: string[],
  maxPoints: number
): { score: number; matchedKeywords: string[]; missingKeywords: string[] } {
  if (!studentAnswer || !studentAnswer.trim()) {
    return { score: 0, matchedKeywords: [], missingKeywords: keywords };
  }

  const normalizedAnswer = studentAnswer.toLowerCase().trim();
  
  // If no keywords provided, do basic text similarity with model answer
  if (!keywords || keywords.length === 0) {
    if (!modelAnswer) return { score: 0, matchedKeywords: [], missingKeywords: [] };
    const modelWords = modelAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    keywords = [...new Set(modelWords)];
    if (keywords.length === 0) return { score: maxPoints * 0.5, matchedKeywords: [], missingKeywords: [] };
  }

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const keyword of keywords) {
    if (normalizedAnswer.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
  // Round to 1 decimal
  const score = Math.round(matchRatio * maxPoints * 10) / 10;

  return { score, matchedKeywords, missingKeywords };
}

/**
 * Parse model_answer_uz field which may be JSON with keywords or plain text.
 */
function parseModelAnswer(modelAnswerUz: string | null): ModelAnswerData {
  if (!modelAnswerUz) return { answer_a: '', answer_b: '', keywords_a: [], keywords_b: [] };
  
  try {
    const parsed = JSON.parse(modelAnswerUz);
    return {
      answer_a: parsed.answer_a || '',
      answer_b: parsed.answer_b || '',
      keywords_a: parsed.keywords_a || [],
      keywords_b: parsed.keywords_b || []
    };
  } catch {
    // Plain text model answer — split by lines or use as-is
    return { answer_a: modelAnswerUz, answer_b: '', keywords_a: [], keywords_b: [] };
  }
}

// --- Rasch Model & T-Score Functions ---

/** Rasch probability: P = e^(θ - b) / (1 + e^(θ - b)) */
function raschProbability(theta: number, difficulty: number): number {
  const exponent = theta - difficulty;
  return Math.exp(exponent) / (1 + Math.exp(exponent));
}

/**
 * Estimate ability (θ) using Newton-Raphson method on Rasch model.
 * responses: array of {correct: boolean, difficulty: number}
 */
function estimateAbility(responses: { correct: boolean; difficulty: number }[]): number {
  if (responses.length === 0) return 0;
  
  const totalCorrect = responses.filter(r => r.correct).length;
  // Edge cases: all correct or all wrong
  if (totalCorrect === 0) return -3;
  if (totalCorrect === responses.length) return 3;
  
  let theta = 0; // initial estimate
  
  for (let iter = 0; iter < 50; iter++) {
    let sumP = 0;
    let sumPQ = 0;
    
    for (const r of responses) {
      const p = raschProbability(theta, r.difficulty);
      sumP += p;
      sumPQ += p * (1 - p);
    }
    
    // Newton-Raphson update: θ_new = θ + (X - Σp) / ΣpQ
    const adjustment = (totalCorrect - sumP) / sumPQ;
    theta += adjustment;
    
    if (Math.abs(adjustment) < 0.001) break;
  }
  
  // Clamp to reasonable range
  return Math.max(-4, Math.min(4, theta));
}

/**
 * Estimate item difficulties from all attempts using Rasch model.
 * Uses proportion correct as initial estimate, then refines.
 */
function estimateItemDifficulties(
  allAttempts: { answers: Record<string, number>; }[],
  questions: { id: string; correct_option: number }[]
): Map<string, number> {
  const difficulties = new Map<string, number>();
  
  for (const q of questions) {
    let correct = 0;
    let total = 0;
    
    for (const attempt of allAttempts) {
      if (attempt.answers && attempt.answers[q.id] !== undefined) {
        total++;
        if (attempt.answers[q.id] === q.correct_option) {
          correct++;
        }
      }
    }
    
    // Convert proportion correct to logit difficulty
    // b = -ln(p / (1-p)) where p is proportion correct
    const p = total > 0 ? Math.max(0.01, Math.min(0.99, correct / total)) : 0.5;
    const difficulty = -Math.log(p / (1 - p));
    difficulties.set(q.id, difficulty);
  }
  
  return difficulties;
}

/**
 * Calculate T-score: T = 50 + 10 * Z where Z = (θ - μ) / σ
 * Uses population mean and std dev of all abilities.
 */
function calculateTScore(theta: number, allThetas: number[]): number {
  if (allThetas.length <= 1) {
    // With insufficient data, use a simple mapping
    return Math.round(50 + 10 * theta);
  }
  
  const mean = allThetas.reduce((a, b) => a + b, 0) / allThetas.length;
  const variance = allThetas.reduce((a, b) => a + (b - mean) ** 2, 0) / allThetas.length;
  const stdDev = Math.sqrt(variance) || 1;
  
  const z = (theta - mean) / stdDev;
  return Math.round(50 + 10 * z);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attempt_id } = await req.json();
    
    if (!attempt_id) {
      return new Response(
        JSON.stringify({ error: "Bad request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate attempt_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(attempt_id)) {
      return new Response(
        JSON.stringify({ error: "Bad request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("Server configuration error");
    }
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get attempt data
    const { data: attempt, error: attemptError } = await supabase
      .from('test_attempts')
      .select('*, tests(*)')
      .eq('id', attempt_id)
      .single();
    
    if (attemptError || !attempt) {
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate: attempt must be finished
    if (attempt.status !== 'finished') {
      return new Response(
        JSON.stringify({ error: "Bad request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent re-evaluation
    if (attempt.evaluation_status === 'completed' || attempt.evaluation_status === 'evaluating') {
      return new Response(
        JSON.stringify({ error: "Already processed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Timing check: attempt must have been finished within last 30 minutes
    const finishedAt = attempt.finished_at ? new Date(attempt.finished_at).getTime() : 0;
    const now = Date.now();
    if (now - finishedAt > 30 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Request expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Update status to evaluating
    await supabase
      .from('test_attempts')
      .update({ evaluation_status: 'evaluating' })
      .eq('id', attempt_id);
    
    // Get ALL questions for the test (using service role bypasses RLS)
    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', attempt.test_id)
      .order('order_index');
    
    if (questionsError || !allQuestions) {
      await supabase
        .from('test_attempts')
        .update({ evaluation_status: 'completed' })
        .eq('id', attempt_id);
      return new Response(
        JSON.stringify({ message: "No questions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mcqQuestions = allQuestions.filter((q: any) => q.question_type === 'single_choice');
    const writtenQuestions = allQuestions.filter((q: any) => q.question_type === 'written');
    const answers = attempt.answers || {};
    const writtenAnswers = attempt.written_answers || {};
    const isMilliySertifikat = attempt.tests?.test_format === 'milliy_sertifikat';

    // --- Compute MCQ scores server-side (difficulty-based points) ---
    let mcqScore = 0;
    const allEvaluations: Record<string, any> = {};

    for (const q of mcqQuestions) {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct_option;
      const questionPoints = q.points || 1; // difficulty-based points (e.g. 1.3, 1.5, 1.7, 2.2)
      if (isCorrect) mcqScore += questionPoints;
      allEvaluations[q.id] = {
        correct_option: q.correct_option,
        user_answer: userAnswer,
        is_correct: isCorrect,
        points_earned: isCorrect ? questionPoints : 0,
        max_points: questionPoints
      };
    }

    // --- Rasch Model Scoring for Milliy Sertifikat ---
    let raschData: any = null;
    
    if (mcqQuestions.length > 0) {
      try {
        // Get all finished attempts for this test to estimate item difficulties
        const { data: allAttempts } = await supabase
          .from('test_attempts')
          .select('answers')
          .eq('test_id', attempt.test_id)
          .eq('status', 'finished');
        
        const finishedAttempts = (allAttempts || []).map(a => ({
          answers: (a.answers || {}) as Record<string, number>
        }));
        
        // Estimate item difficulties
        const difficulties = estimateItemDifficulties(finishedAttempts, mcqQuestions);
        
        // Build responses for current attempt
        const responses = mcqQuestions.map(q => ({
          correct: answers[q.id] === q.correct_option,
          difficulty: difficulties.get(q.id) || 0
        }));
        
        // Estimate ability (θ) for current attempt
        const theta = estimateAbility(responses);
        
        // Estimate abilities for all attempts to calculate T-score
        const allThetas = finishedAttempts.map(a => {
          const resp = mcqQuestions.map(q => ({
            correct: a.answers[q.id] === q.correct_option,
            difficulty: difficulties.get(q.id) || 0
          }));
          return estimateAbility(resp);
        });
        
        const tScore = calculateTScore(theta, allThetas);
        
        raschData = {
          theta: Math.round(theta * 1000) / 1000,
          t_score: tScore,
          item_difficulties: Object.fromEntries(difficulties),
          total_attempts_analyzed: finishedAttempts.length
        };
      } catch (raschError) {
        console.error("Rasch model error:", raschError);
        // Continue without Rasch data
      }
    }

    // --- Evaluate written questions ---
    let totalWrittenScore = 0;

    // Check if ANY written question has an actual answer
    const hasAnyWrittenAnswer = writtenQuestions.some(q => {
      const ans = writtenAnswers[q.id] as WrittenAnswer | undefined;
      return ans && (ans.answer_a?.trim() || ans.answer_b?.trim());
    });

    if (writtenQuestions.length === 0 || !hasAnyWrittenAnswer) {
      // No written questions or all empty — assign 0 to all, skip AI entirely
      for (const q of writtenQuestions) {
        allEvaluations[q.id] = {
          score: 0,
          score_a: 0,
          score_b: 0,
          max_points_a: q.points_a || 1.5,
          max_points_b: q.points_b || 1.7,
          feedback_uz: "Javob berilmagan",
          feedback_ru: "Ответ не предоставлен",
          strengths: [],
          missing_points: ["Javob yozilmagan / Ответ не написан"]
        };
      }

      const mcqCorrectCount = mcqQuestions.filter(q => answers[q.id] === q.correct_option).length;
      const updateData: any = {
        ai_evaluation: raschData ? { ...allEvaluations, _rasch: raschData } : allEvaluations,
        mcq_score: mcqScore,
        correct_answers: mcqCorrectCount,
        written_score: 0,
        evaluation_status: 'completed',
        score: mcqScore
      };

      await supabase
        .from('test_attempts')
        .update(updateData)
        .eq('id', attempt_id);

      return new Response(
        JSON.stringify({ success: true, mcq_score: mcqScore, written_score: 0, total_score: mcqScore, rasch: raschData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Evaluate each written question using keyword matching against model answer
    for (const question of writtenQuestions) {
      const answer = writtenAnswers[question.id] as WrittenAnswer | undefined;
      const pointsA = question.points_a || 1.5;
      const pointsB = question.points_b || 1.7;
      
      if (!answer || (!answer.answer_a?.trim() && !answer.answer_b?.trim())) {
        allEvaluations[question.id] = {
          score: 0, score_a: 0, score_b: 0,
          max_points_a: pointsA, max_points_b: pointsB,
          feedback_uz: "Javob berilmagan",
          feedback_ru: "Ответ не предоставлен",
          strengths: [],
          missing_points: ["Javob yozilmagan"]
        };
        continue;
      }

      // Parse model answer (may be JSON with keywords or plain text)
      const modelData = parseModelAnswer(question.model_answer_uz);

      // Evaluate a-shart
      const evalA = evaluateByKeywords(answer.answer_a || '', modelData.answer_a, modelData.keywords_a, pointsA);
      // Evaluate b-shart
      const evalB = evaluateByKeywords(answer.answer_b || '', modelData.answer_b, modelData.keywords_b, pointsB);

      const totalScore = evalA.score + evalB.score;
      const strengths: string[] = [];
      const missingPoints: string[] = [];

      if (evalA.matchedKeywords.length > 0) strengths.push(`a-shart: ${evalA.matchedKeywords.join(', ')} topildi`);
      if (evalB.matchedKeywords.length > 0) strengths.push(`b-shart: ${evalB.matchedKeywords.join(', ')} topildi`);
      if (evalA.missingKeywords.length > 0) missingPoints.push(`a-shart: ${evalA.missingKeywords.join(', ')} yetishmayapti`);
      if (evalB.missingKeywords.length > 0) missingPoints.push(`b-shart: ${evalB.missingKeywords.join(', ')} yetishmayapti`);

      const feedbackUz = `a-shart: ${evalA.score}/${pointsA} ball, b-shart: ${evalB.score}/${pointsB} ball. Jami: ${totalScore}/${pointsA + pointsB} ball.`;
      const feedbackRu = `a-условие: ${evalA.score}/${pointsA} балл, b-условие: ${evalB.score}/${pointsB} балл. Итого: ${totalScore}/${pointsA + pointsB} балл.`;

      allEvaluations[question.id] = {
        score: totalScore,
        score_a: evalA.score,
        score_b: evalB.score,
        max_points_a: pointsA,
        max_points_b: pointsB,
        feedback_uz: feedbackUz,
        feedback_ru: feedbackRu,
        strengths,
        missing_points: missingPoints
      };
      totalWrittenScore += totalScore;
    }
    
    
    // Add Rasch data to evaluations
    if (raschData) {
      allEvaluations['_rasch'] = raschData;
    }
    
    // Update attempt with all evaluation results
    const mcqCorrectCount = mcqQuestions.filter(q => answers[q.id] === q.correct_option).length;
    const totalScore = mcqScore + totalWrittenScore;
    const { error: updateError } = await supabase
      .from('test_attempts')
      .update({
        ai_evaluation: allEvaluations,
        mcq_score: mcqScore,
        correct_answers: mcqCorrectCount,
        written_score: totalWrittenScore,
        evaluation_status: 'completed',
        score: totalScore
      })
      .eq('id', attempt_id);
    
    if (updateError) {
      console.error("Error updating attempt:", updateError);
      throw updateError;
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        mcq_score: mcqScore,
        written_score: totalWrittenScore,
        total_score: totalScore,
        rasch: raschData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
