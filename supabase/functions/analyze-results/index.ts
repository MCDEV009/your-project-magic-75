import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attempt_id, analysis_type } = await req.json();
    
    if (!attempt_id && analysis_type !== 'dashboard') {
      return new Response(JSON.stringify({ error: "attempt_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Dashboard analytics
    if (analysis_type === 'dashboard') {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all attempts with test info
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("id, test_id, score, mcq_score, written_score, total_questions, correct_answers, status, evaluation_status, started_at, finished_at")
        .eq("status", "finished")
        .order("started_at", { ascending: false })
        .limit(200);

      const { data: tests } = await supabase.from("tests").select("id, title_uz, subject_id");
      const { data: subjects } = await supabase.from("subjects").select("id, name_uz");

      const testMap = Object.fromEntries((tests || []).map(t => [t.id, t]));
      const subjectMap = Object.fromEntries((subjects || []).map(s => [s.id, s]));

      // Build stats summary
      const totalAttempts = (attempts || []).length;
      const avgScore = totalAttempts > 0
        ? (attempts || []).reduce((s, a) => s + (a.score || 0), 0) / totalAttempts
        : 0;

      const testStats: Record<string, { name: string; attempts: number; avgScore: number; scores: number[] }> = {};
      for (const a of attempts || []) {
        const test = testMap[a.test_id];
        if (!test) continue;
        if (!testStats[a.test_id]) {
          testStats[a.test_id] = { name: test.title_uz, attempts: 0, avgScore: 0, scores: [] };
        }
        testStats[a.test_id].attempts++;
        testStats[a.test_id].scores.push(a.score || 0);
      }
      for (const key of Object.keys(testStats)) {
        const s = testStats[key];
        s.avgScore = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
      }

      const summaryText = `Jami urinishlar: ${totalAttempts}. O'rtacha ball: ${avgScore.toFixed(1)}. Testlar: ${Object.values(testStats).map(t => `${t.name} (${t.attempts} urinish, o'rtacha: ${t.avgScore.toFixed(1)})`).join(', ')}.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Sen ta'lim analitikasi bo'yicha mutaxassissan. Berilgan statistik ma'lumotlar asosida qisqa va aniq tahlil ber. Javobni JSON formatida ber:
{
  "summary": "Umumiy holat haqida 2-3 jumla",
  "strengths": ["Kuchli tomon 1", "Kuchli tomon 2"],
  "weaknesses": ["Zaif tomon 1", "Zaif tomon 2"],
  "recommendations": ["Tavsiya 1", "Tavsiya 2", "Tavsiya 3"],
  "risk_students_percent": 15
}`
            },
            { role: "user", content: summaryText }
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      let analysis;
      try {
        const content = aiData.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content };
      } catch {
        analysis = { summary: aiData.choices[0].message.content };
      }

      // Save to analysis history
      await supabase.from('ai_analysis_history').insert({
        analysis_type: 'dashboard',
        analysis_result: { totalAttempts, avgScore: avgScore.toFixed(1), testStats, analysis },
        model_used: 'google/gemini-3-flash-preview',
      });

      return new Response(JSON.stringify({
        totalAttempts,
        avgScore: avgScore.toFixed(1),
        testStats,
        analysis,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Individual attempt analysis
    const { data: attempt } = await supabase
      .from("test_attempts")
      .select("*")
      .eq("id", attempt_id)
      .single();

    if (!attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: test } = await supabase
      .from("tests")
      .select("*")
      .eq("id", attempt.test_id)
      .single();

    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", attempt.test_id)
      .order("order_index");

    const answers = attempt.answers || {};
    const writtenAnswers = attempt.written_answers || {};
    const aiEvaluation = attempt.ai_evaluation || {};

    const mcqQuestions = (questions || []).filter(q => q.question_type === "single_choice");
    const writtenQs = (questions || []).filter(q => q.question_type === "written");

    // Build analysis context
    const correctMcq = mcqQuestions.filter(q => (answers as any)[q.id] === q.correct_option).length;
    const wrongMcq = mcqQuestions.filter(q => (answers as any)[q.id] !== undefined && (answers as any)[q.id] !== q.correct_option);
    const unansweredMcq = mcqQuestions.filter(q => (answers as any)[q.id] === undefined).length;

    const wrongTopics = wrongMcq.map(q => q.question_text_uz.substring(0, 80)).join("; ");

    const writtenResults = writtenQs.map(q => {
      const ev = (aiEvaluation as any)[q.id];
      return {
        question: q.question_text_uz.substring(0, 60),
        score_a: ev?.score_a ?? 'N/A',
        score_b: ev?.score_b ?? 'N/A',
        feedback: ev?.feedback_a || ev?.feedback_b || '',
      };
    });

    const contextText = `Test: ${test?.title_uz}. 
MCQ: ${correctMcq}/${mcqQuestions.length} to'g'ri, ${unansweredMcq} javobsiz.
Noto'g'ri javob berilgan savollar: ${wrongTopics || 'yo\'q'}.
Yozma savollar: ${JSON.stringify(writtenResults)}.
Umumiy ball: ${attempt.score}, MCQ ball: ${attempt.mcq_score}, Yozma ball: ${attempt.written_score}.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Sening isming "Al Xorazmiy" — buyuk matematik nomidan ilhomlangan ta'lim AI assistentisan. O'zbek talabalariga test natijalarini chuqur tahlil qilib berasan. Yumshoq, do'stona va aniq ohangda yoz. Berilgan test natijalari asosida talabaning qaysi MAVZULARNI o'zlashtira olmaganini aniqla (savollar mazmunidan mavzularni ajratib ol — masalan: "Algebraik tenglamalar", "Statistika asoslari", "Fizik kattaliklar"). Javobni faqat JSON formatida ber:
{
  "overall_assessment": "Umumiy baho (1-2 jumla, 'Al Xorazmiy' nomidan)",
  "strengths": ["Kuchli tomon 1", "Kuchli tomon 2"],
  "weaknesses": ["Zaif tomon 1", "Zaif tomon 2"],
  "unmastered_topics": ["Mavzu 1", "Mavzu 2", "Mavzu 3"],
  "recommendations": ["Tavsiya 1", "Tavsiya 2", "Tavsiya 3"],
  "study_plan": "Qisqa o'qish rejasi (2-3 jumla)",
  "grade": "A/B/C/D/F"
}`
          },
          { role: "user", content: contextText }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    let analysis;
    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall_assessment: content };
    } catch {
      analysis = { overall_assessment: aiData.choices[0].message.content };
    }

    // Save to analysis history
    await supabase.from('ai_analysis_history').insert({
      analysis_type: 'attempt',
      attempt_id: attempt_id,
      test_id: attempt.test_id,
      participant_id: attempt.participant_id,
      analysis_result: analysis,
      model_used: 'google/gemini-3-flash-preview',
    });

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
