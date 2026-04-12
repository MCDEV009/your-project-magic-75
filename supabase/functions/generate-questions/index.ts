import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  subject: string;
  questionType: "single_choice" | "written";
  difficulty: "easy" | "medium" | "hard";
  count: number;
  topic?: string;
  language?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Authentication: require admin role ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- End authentication ---

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: GenerateRequest = await req.json();
    const { subject, questionType, difficulty, count, topic, language = "uz" } = body;

    console.log("Generating questions:", { subject, questionType, difficulty, count, topic, language });

    const difficultyDescriptions = {
      easy: "moderate difficulty questions that test solid understanding — avoid trivially simple questions that can be answered without real knowledge",
      medium: "challenging questions requiring good understanding and analytical thinking — questions should make students think carefully",
      hard: "very challenging questions requiring deep knowledge, critical analysis, and multi-step reasoning"
    };

    const languageInstructions = {
      uz: "Generate questions in Uzbek language. Use proper Uzbek grammar and terminology.",
      ru: "Generate questions in Russian language. Use proper Russian grammar and terminology.",
      en: "Generate questions in English language. Use proper English grammar and terminology."
    };

    let systemPrompt = "";
    let userPrompt = "";

    if (questionType === "single_choice") {
      systemPrompt = `You are an expert exam question generator for the Uzbekistan Milliy Sertifikat (National Certificate) exam system.
Your task is to generate high-quality multiple choice questions that match the official exam format and standards.

Rules:
1. Questions must be factually accurate and educationally valuable
2. All 4 options must be plausible, avoiding obviously wrong answers
3. Include only one correct answer
4. Avoid trick questions or ambiguous wording
5. Questions should test genuine understanding, not just memorization
6. CRITICAL: Do NOT generate trivially easy questions. Every question should require real subject knowledge. Avoid questions that can be answered by common sense alone.
7. ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.uz}
8. Do not include inappropriate, offensive, or harmful content`;

      userPrompt = `Generate ${count} multiple choice questions for the subject "${subject}".
Difficulty level: ${difficultyDescriptions[difficulty]}
${topic ? `Focus on the topic: ${topic}` : "Cover various topics within the subject"}

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "type": "single_choice",
      "question_text": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option": 0,
      "explanation": "Brief explanation of why this answer is correct"
    }
  ]
}

IMPORTANT: correct_option is a zero-based index (0 for A, 1 for B, 2 for C, 3 for D).`;
    } else {
      systemPrompt = `You are an expert exam question generator for the Uzbekistan Milliy Sertifikat (National Certificate) exam system.
Your task is to generate high-quality written/open-ended questions that match the official exam format for questions 36-45.

IMPORTANT FORMAT: Each written question in Milliy Sertifikat has:
1. A main problem/scenario text (masala)
2. Two conditions/tasks (a-shart and b-shart) that the student must answer separately
3. A CORRECT ANSWER for each condition (a-shart and b-shart) — these will be used to automatically check student answers

Rules:
1. The main question text should present a scenario, problem, or context
2. a-shart (Condition A) should be the first specific task/question based on the scenario
3. b-shart (Condition B) should be the second specific task/question based on the scenario
4. Both conditions should be related but test different aspects
5. model_answer_a must be the EXACT correct answer for a-shart
6. model_answer_b must be the EXACT correct answer for b-shart
7. Include KEY WORDS that must appear in a correct answer
8. ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.uz}
9. Do not include inappropriate, offensive, or harmful content`;

      userPrompt = `Generate ${count} written (open-ended) questions for the subject "${subject}".
Difficulty level: ${difficultyDescriptions[difficulty]}
${topic ? `Focus on the topic: ${topic}` : "Cover various topics within the subject"}

Each question must have a main problem text and TWO conditions (a-shart and b-shart).
For each condition, provide the CORRECT answer and KEY WORDS for checking.

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "type": "written",
      "question_text": "Main problem/scenario text here",
      "condition_a": "First condition/task (a-shart)",
      "condition_b": "Second condition/task (b-shart)",
      "model_answer_a": "Exact correct answer for a-shart",
      "model_answer_b": "Exact correct answer for b-shart",
      "keywords_a": ["keyword1", "keyword2", "keyword3"],
      "keywords_b": ["keyword1", "keyword2", "keyword3"],
      "rubric": "Scoring criteria"
    }
  ]
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI response content:", content);

    // Robust JSON extraction from LLM output
    function extractJsonFromResponse(response: string): unknown {
      let cleaned = response
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in AI response");
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      try {
        return JSON.parse(cleaned);
      } catch (_e) {
        // Fix common LLM JSON issues
        cleaned = cleaned
          .replace(/,\s*}/g, "}") // trailing commas
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, "") // control characters
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); // invalid escapes (LaTeX)

        return JSON.parse(cleaned);
      }
    }

    const parsedResponse = extractJsonFromResponse(content) as { questions?: unknown[] };

    if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
      throw new Error("Invalid response format from AI");
    }

    console.log(`Successfully generated ${parsedResponse.questions.length} questions`);

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Generate questions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
