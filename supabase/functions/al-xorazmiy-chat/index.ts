import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attempt_id, messages, mode, participant_id } = await req.json();

    if (!attempt_id || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "attempt_id va messages talab qilinadi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build context: attempt + analyses
    const { data: attempt } = await supabase
      .from("test_attempts")
      .select("*")
      .eq("id", attempt_id)
      .maybeSingle();

    const effectiveParticipantId = participant_id || attempt?.participant_id;

    const { data: analyses } = await supabase
      .from("question_analyses")
      .select("*")
      .eq("attempt_id", attempt_id);

    const { data: history } = await supabase
      .from("ai_analysis_history")
      .select("analysis_result")
      .eq("attempt_id", attempt_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const previousAnalysis = history?.[0]?.analysis_result || {};

    const summary = {
      score: attempt?.score,
      mcq_score: attempt?.mcq_score,
      written_score: attempt?.written_score,
      total_questions: attempt?.total_questions,
      correct_answers: attempt?.correct_answers,
      previous_analysis: previousAnalysis,
      questions_summary: (analyses || []).map((a: any) => ({
        question_id: a.question_id,
        type: a.question_type,
        is_correct: a.is_correct,
        points: `${a.points_earned}/${a.max_points}`,
      })),
    };

    const baseSystem = `Sen "Al Xorazmiy" — talabalarga yordam beruvchi AI ustozsan. O'zbek tilida javob ber. Markdown va LaTeX ($...$ yoki $$...$$) ishlatishing mumkin. Talaba test natijalari haqida savol berganda quyidagi ma'lumotlardan foydalan:

TALABA NATIJALARI:
${JSON.stringify(summary, null, 2)}

Qisqa, aniq va do'stona javob ber. Mavzularni tushuntir, mashq tavsiya qil.`;

    const practicePrompt = `${baseSystem}

VAZIFA: Talaba o'zlashtirmagan mavzular bo'yicha mashq savollarini yarat.
- Avval previous_analysis ichidagi "unmastered_topics" yoki kuchsiz mavzularni aniqlab ol.
- Har bir mavzu uchun 3-5 ta yangi mashq savol yarat (test va yozma aralash).
- Har bir savol uchun: 1) Mavzu nomi, 2) Savol matni, 3) To'g'ri javob, 4) Qisqa tushuntirish.
- Markdown sarlavhalar va LaTeX bilan chiroyli formatla.`;

    const systemPrompt = mode === "practice" ? practicePrompt : baseSystem;

    // Persist last user message before streaming
    const lastUserMsg = [...messages].reverse().find((m: ChatMessage) => m.role === "user");
    if (lastUserMsg && effectiveParticipantId) {
      await supabase.from("al_xorazmiy_chat_messages").insert({
        participant_id: effectiveParticipantId,
        attempt_id,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m: ChatMessage) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        }),
      },
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit oshdi" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI krediti tugagan" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: errText }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee the stream so we can persist the assistant reply
    const [streamForClient, streamForStorage] = aiResponse.body!.tee();

    // Background task: read storage stream, accumulate, persist
    (async () => {
      try {
        const reader = streamForStorage.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) assistantText += delta;
            } catch {}
          }
        }
        if (assistantText && effectiveParticipantId) {
          await supabase.from("al_xorazmiy_chat_messages").insert({
            participant_id: effectiveParticipantId,
            attempt_id,
            role: "assistant",
            content: assistantText,
          });
        }
      } catch (e) {
        console.error("persist assistant error", e);
      }
    })();

    return new Response(streamForClient, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("al-xorazmiy-chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});