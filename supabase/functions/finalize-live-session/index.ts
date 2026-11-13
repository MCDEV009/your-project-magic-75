import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { estimateAbility, estimateItemDifficulties, calculateTScore } from "../_shared/rasch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiveQuestionRow {
  id: string;
  correct_option: number;
  question_type?: string;
}

interface LiveAttemptRow {
  id: string;
  answers?: Record<string, number> | null;
  ai_evaluation?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { session_id } = await req.json();
    if (!session_id) return json({ error: "session_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error } = await admin
      .from("live_sessions").select("*").eq("id", session_id).single();
    if (error || !session) return json({ error: "not_found" }, 404);

    if (session.status === "ended" && session.published_at) {
      return json({ success: true, already: true });
    }

    const now = Date.now();
    const endsAt = session.ends_at ? new Date(session.ends_at).getTime() : now;
    const timeUp = now >= endsAt;

    // Check if all joined participants are finished
    const { data: parts } = await admin
      .from("live_participants").select("id, finished_at").eq("session_id", session_id);
    const total = parts?.length ?? 0;
    const done = parts?.filter((p) => p.finished_at).length ?? 0;
    const allDone = total > 0 && done === total;

    if (!timeUp && !allDone) {
      return json({ success: false, reason: "not_ready", total, done });
    }

    // Auto-finish in-progress attempts tied to session
    await admin
      .from("test_attempts")
      .update({ status: "finished", finished_at: new Date().toISOString(), evaluation_status: "pending" })
      .eq("session_id", session_id)
      .eq("status", "in_progress");

    // Load attempts + questions
    const { data: attempts } = await admin
      .from("test_attempts").select("*").eq("session_id", session_id).eq("status", "finished");
    const { data: questions } = await admin
      .from("questions").select("*").eq("test_id", session.test_id).order("order_index");

    const mcq = (questions ?? []).filter((q: LiveQuestionRow) => q.question_type === "single_choice");

    // Cohort norm: use session attempts if >=5, else global for the test
    let normSource: { answers: Record<string, number> }[] = (attempts ?? []).map((a: LiveAttemptRow) => ({ answers: a.answers || {} }));
    if (normSource.length < 5) {
      const { data: global } = await admin
        .from("test_attempts").select("answers").eq("test_id", session.test_id).eq("status", "finished");
      normSource = (global ?? []).map((a: LiveAttemptRow) => ({ answers: (a.answers || {}) as Record<string, number> }));
    }
    const bMap = estimateItemDifficulties(normSource, mcq);

    // Compute abilities for each session participant
    const thetas: { attempt_id: string; theta: number }[] = [];
    for (const a of attempts ?? []) {
      const resp = mcq.map((q: LiveQuestionRow) => ({
        correct: (a.answers ?? {})[q.id] === q.correct_option,
        difficulty: bMap.get(q.id) ?? 0,
      }));
      thetas.push({ attempt_id: a.id, theta: estimateAbility(resp) });
    }
    const allThetas = thetas.map((x) => x.theta);

    // Rank by theta desc
    const ranked = [...thetas].sort((a, b) => b.theta - a.theta);
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const t = calculateTScore(r.theta, allThetas);
      const attempt = (attempts ?? []).find((a: LiveAttemptRow) => a.id === r.attempt_id);
      const existingEval = (attempt?.ai_evaluation as Record<string, unknown> | null | undefined) ?? {};
      const rasch = { theta: Math.round(r.theta * 1000) / 1000, t_score: t, rank: i + 1, session_id };
      await admin.from("test_attempts").update({
        ai_evaluation: { ...existingEval, _rasch: rasch, _session_rank: i + 1 },
      }).eq("id", r.attempt_id);
    }

    await admin.from("live_sessions").update({
      status: "ended",
      published_at: new Date().toISOString(),
    }).eq("id", session_id);

    return json({ success: true, ranked: ranked.length });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}