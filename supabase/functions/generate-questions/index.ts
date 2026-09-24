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
  /** Blok uslubi: oddiy yopiq test yoki moslashtirish topshirig'i */
  style?: "mcq" | "matching";
  /** Qo'shimcha blueprint ko'rsatmasi */
  instruction?: string;
}

Deno.serve(async (req) => {
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

    // Check admin-level role (admin, super_admin yoki editor savol yarata oladi)
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin', 'editor']);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- End authentication ---

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const body: GenerateRequest = await req.json();
    const { subject, questionType, difficulty, count, topic, language = "uz", style, instruction } = body;

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

    // 131-MOCK matematika shabloni (PDF asosida): real mock savollar uslubi
    const isMath = /matematik|math/i.test(subject) || /matematik/i.test(topic ?? "") || /matematik/i.test(instruction ?? "");
    const MATH_STYLE_GUIDE = `
MATH TEMPLATE (based on official "131-MOCK" Milliy Sertifikat sample):
Style rules:
1. Every math expression MUST be in LaTeX: inline $...$ (e.g. $\\overline{abcd}$, $\\frac{a}{b}$) and display $$...$$ for standalone formulas.
2. Use official Uzbek exam phrasing: "Hisoblang.", "Ifodani soddalashtiring.", "Tenglamaning haqiqiy ildizlari ko'paytmasini toping.", "Tengsizlikni yeching.", "...ning qiymatini toping."
3. Cover these topic types across the block: sonlar nazariyasi (raqamlar, $\\overline{abcd}$), hisoblash (ildizlar $4\\sqrt{3}$, kasr qismi $\\{x\\}$, butun qism $[x]$), foiz/masala (kran, savdo foyda-zarar), daraja ko'rsatkichli ifodalar ($2^x$, $6^{2-x}$), arifmetik/geometrik progressiya ($S_n$, maxraj), algebraik soddalashtirish ($\\frac{(m-n)^2+2n^2}{m^3+n^3}$), trigonometriya ($\\sin x$, $\\cos x$, $tg$), logarifmik/ko'rsatkichli tenglamalar ($\\log_{x^2}16$), modulli tenglamalar/sistemalar ($|x+y|+|x-y|=12$), tengsizliklar, funksiya grafigi Ox o'qiga urinishi, aniq integral $\\int_1^6 \\{x\\}dx$, hosila $f^{(2026)}(x)$, planimetriya (aylana, vatar, uchburchak yuzi, trapetsiya o'rta chizig'i), stereometriya (kub, prizma), kombinatorika, to'garak/Venn masalalari.
4. Difficulty: multi-step, olympiad-lite like the samples — never one-step arithmetic. Distractor options must be plausible results of common mistakes.
5. Options must be in LaTeX when they contain formulas, e.g. "$\\frac{1}{49}$", "$2\\sqrt{2}$", "$(-\\infty; 1) \\cup (1; \\infty)$", "$\\{2\\}$".
Example items in this exact style (DO NOT copy, just match the style):
- "$a,b,c,d$ - raqamlar bo'lib, $\\overline{abcd}$ to'rt xonali son uchun $\\overline{abcd} = \\overline{ab} \\cdot \\overline{cd} + \\overline{ab} + \\overline{cd}$ shartni qanoatlantiruvchi eng kichik to'rt xonali sonning raqamlari yig'indisini toping." options: 19 / 24 / 27 / 30
- "Hisoblang. $$\\frac{2^x \\cdot 6^{2-x}}{15^{-x-1} \\cdot 5^{x+1}} \\cdot \\frac{2^x}{12}$$" options in LaTeX
- "Idishning 30% qismi A krani orqali 6 soatda to'ldiriladi, 10% qismi B krani orqali 3 soatda bo'shatiladi..."
`;

    const MATH_WRITTEN_GUIDE = `
MATH WRITTEN TEMPLATE (questions 36-45 of the official mock):
1. Main text presents a rich multi-part problem with LaTeX: systems of equations in $$\\begin{cases}...\\end{cases}$$, trigonometric equations, function problems with conditions like $f(1)=6$, $f'(1)=8$, $\\int_0^1 f(x)dx = 3$, geometry with named points ($ABC$ uchburchak, $AD \\perp BC$), stereometry ($ABCDA_1B_1C_1D_1$ kub), applied problems (gugurt qutisi hajmi/xarajat).
2. a-shart: the first computable result (e.g. "Tenglamaning eng kichik musbat ildizini toping").
3. b-shart: a deeper follow-up depending on part a (e.g. "Tenglama $[0;\\pi]$ oraliqdagi nechta yechimga ega?").
4. Model answer must show full step-by-step solution with LaTeX and final numeric answers for both a and b.
`;

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

      if (isMath) {
        userPrompt += `\n${MATH_STYLE_GUIDE}`;
      }

      if (style === "matching") {
        userPrompt += `

MATCHING BLOCK FORMAT (BMBA Block 2):
- Each question_text must present TWO lists: a numbered list (1,2,3,4) and a lettered list (A,B,C,D) that must be matched.
- Put each list item on its own line inside question_text.
- The four options must be full matching combinations, e.g. "1-A, 2-C, 3-D, 4-B".
- Exactly one option is the fully correct combination.`;
      }

      if (instruction) {
        userPrompt += `\n\nADDITIONAL BLUEPRINT INSTRUCTION: ${instruction}`;
      }
    } else {
      systemPrompt = `You are an expert exam question generator for the Uzbekistan Milliy Sertifikat (National Certificate) exam system.
Your task is to generate high-quality written/open-ended questions that match the official exam format for questions 36-45.

IMPORTANT FORMAT: Each written question in Milliy Sertifikat has:
1. A main problem/scenario text (masala)
2. Two conditions/tasks (a-shart and b-shart) that the student must answer separately

Rules:
1. The main question text should present a scenario, problem, or context
2. a-shart (Condition A) should be the first specific task/question based on the scenario
3. b-shart (Condition B) should be the second specific task/question based on the scenario
4. Both conditions should be related but test different aspects
5. Create clear grading rubrics for 0-2 point scoring (1 point per condition)
6. Model answers should cover both conditions
7. ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.uz}
8. Do not include inappropriate, offensive, or harmful content`;

      userPrompt = `Generate ${count} written (open-ended) questions for the subject "${subject}".
Difficulty level: ${difficultyDescriptions[difficulty]}
${topic ? `Focus on the topic: ${topic}` : "Cover various topics within the subject"}

Each question must have a main problem text and TWO conditions (a-shart and b-shart).

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "type": "written",
      "question_text": "Main problem/scenario text here",
      "condition_a": "First condition/task (a-shart)",
      "condition_b": "Second condition/task (b-shart)",
      "model_answer": "Expected model answer covering both conditions (0-2 points)",
      "rubric": "Scoring: 0 = no answer; 0.5 = weak attempt; 1 = one condition correct; 1.5 = both partially; 2 = both fully correct"
    }
  ]
}`;
      if (isMath) {
        userPrompt += `\n${MATH_WRITTEN_GUIDE}`;
      }
      if (instruction) {
        userPrompt += `\n\nADDITIONAL BLUEPRINT INSTRUCTION: ${instruction}`;
      }
    }

    const callAI = () => fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });

    // Rate limit (429) va vaqtinchalik 5xx xatolarda Retry-After'ni hurmat qilgan holda qayta urinish
    let response = await callAI();
    for (let attempt = 1; attempt <= 3 && (response.status === 429 || response.status >= 500); attempt++) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20000)
        : Math.min(2000 * 2 ** (attempt - 1), 15000) + Math.floor(Math.random() * 500);
      console.log(`AI ${response.status}; ${waitMs}ms kutib qayta urinish (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, waitMs));
      response = await callAI();
    }

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 30;
        return new Response(JSON.stringify({
          error: `AI xizmati band (limit). ${seconds} soniyadan keyin qayta urinib ko'ring.`,
          retry_after: seconds,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(seconds) },
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
        // Pairwise scanner: escape lone backslashes (LaTeX \frac, \sqrt ...)
        // without breaking already-valid escape sequences like \\ or \"
        const escapeLatex = (s: string) => {
          let out = "";
          for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c !== "\\") { out += c; continue; }
            const next = s[i + 1];
            if (next === undefined) { out += "\\\\"; continue; }
            if ('"\\/bfnrtu'.includes(next)) { out += c + next; i++; continue; }
            out += "\\\\";
          }
          return out;
        };
        let fixed = escapeLatex(
          cleaned
            .replace(/,\s*}/g, "}") // trailing commas
            .replace(/,\s*]/g, "]")
            .replace(/[\x00-\x1F\x7F]/g, "") // control characters
        );
        try {
          return JSON.parse(fixed);
        } catch (_e2) {
          // Truncated JSON: try to salvage a complete questions array
          const arrStart = fixed.indexOf('"questions"');
          if (arrStart !== -1) {
            const bracket = fixed.indexOf('[', arrStart);
            if (bracket !== -1) {
              // Find last complete object in array by scanning balanced braces
              let depth = 0, inStr = false, esc = false, lastEnd = -1;
              for (let i = bracket + 1; i < fixed.length; i++) {
                const c = fixed[i];
                if (esc) { esc = false; continue; }
                if (c === '\\') { esc = true; continue; }
                if (c === '"') { inStr = !inStr; continue; }
                if (inStr) continue;
                if (c === '{') depth++;
                else if (c === '}') { depth--; if (depth === 0) lastEnd = i; }
              }
              if (lastEnd !== -1) {
                const salvaged = fixed.substring(0, lastEnd + 1) + ']}';
                return JSON.parse(salvaged);
              }
            }
          }
          throw _e2;
        }
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
