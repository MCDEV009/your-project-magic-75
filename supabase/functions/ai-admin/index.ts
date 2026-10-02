import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chatUrl } from "../_shared/aiProvider.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const base = (u: string) => u.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]);
    if (!roles?.length) return json({ error: "Admin huquqi kerak" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const getProvider = async (id: string) => {
      const { data } = await db.from("ai_providers").select("*").eq("id", id).maybeSingle();
      if (!data) throw new Error("Provayder topilmadi");
      return data;
    };

    if (action === "test") {
      const p = await getProvider(String(body.provider_id));
      const t0 = Date.now();
      const r = await fetch(chatUrl(p.base_url), {
        method: "POST",
        headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: p.model, messages: [{ role: "user", content: "Reply with exactly: OK" }] }),
      });
      const text = await r.text();
      if (!r.ok) return json({ ok: false, status: r.status, error: text.slice(0, 500) });
      let reply = "";
      try { reply = JSON.parse(text).choices?.[0]?.message?.content ?? ""; } catch {}
      return json({ ok: true, ms: Date.now() - t0, reply: reply.slice(0, 200) });
    }

    if (action === "finetune_start") {
      const p = await getProvider(String(body.provider_id));
      const baseModel = String(body.base_model || p.model);
      let q = db.from("questions")
        .select("question_text_uz, question_type, options, correct_option, model_answer_uz, condition_a_uz, condition_b_uz, tests!inner(subject_id, subjects(name_uz))")
        .limit(2000);
      if (body.subject_id) q = q.eq("tests.subject_id", body.subject_id);
      const { data: qs, error } = await q;
      if (error) throw error;
      const sys = "Sen Milliy Sertifikat imtihoni uchun savol yaratuvchi ekspertsan. Faqat JSON qaytar.";
      const lines = (qs ?? []).filter((x: any) => x.question_text_uz?.trim()).map((x: any) => {
        const subject = x.tests?.subjects?.name_uz ?? "Umumiy";
        const out = x.question_type === "written"
          ? { type: "written", question: x.question_text_uz, condition_a: x.condition_a_uz, condition_b: x.condition_b_uz, model_answer: x.model_answer_uz }
          : { type: "single_choice", question: x.question_text_uz, options: x.options, correct_option: x.correct_option };
        return JSON.stringify({ messages: [
          { role: "system", content: sys },
          { role: "user", content: `Fan: ${subject}. ${x.question_type === "written" ? "Yozma" : "Test"} savol yarat.` },
          { role: "assistant", content: JSON.stringify(out) },
        ] });
      });
      if (lines.length < 10) return json({ error: `Kamida 10 ta savol kerak, bazada ${lines.length} ta bor` }, 400);

      const form = new FormData();
      form.append("purpose", "fine-tune");
      form.append("file", new Blob([lines.join("\n")], { type: "application/jsonl" }), "training.jsonl");
      const up = await fetch(`${base(p.base_url)}/files`, { method: "POST", headers: { Authorization: `Bearer ${p.api_key}` }, body: form });
      const upText = await up.text();
      if (!up.ok) return json({ error: `Fayl yuklanmadi (${up.status}): ${upText.slice(0, 400)}. Bu provayder model o'qitishni qo'llamasligi mumkin.` }, 400);
      const fileId = JSON.parse(upText).id;

      const jr = await fetch(`${base(p.base_url)}/fine_tuning/jobs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ training_file: fileId, model: baseModel, suffix: "alkharazmiy" }),
      });
      const jText = await jr.text();
      if (!jr.ok) return json({ error: `O'qitish boshlanmadi (${jr.status}): ${jText.slice(0, 400)}` }, 400);
      const job = JSON.parse(jText);
      const { data: row } = await db.from("ai_finetune_jobs").insert({
        provider_id: p.id, provider_job_id: job.id, training_file_id: fileId, base_model: baseModel,
        status: job.status ?? "queued", examples_count: lines.length, subject_id: body.subject_id || null, created_by: user.id,
      }).select().single();
      return json({ ok: true, job: row });
    }

    if (action === "finetune_status") {
      const { data: j } = await db.from("ai_finetune_jobs").select("*").eq("id", body.job_id).maybeSingle();
      if (!j?.provider_job_id) return json({ error: "Topilmadi" }, 404);
      const p = await getProvider(j.provider_id);
      const r = await fetch(`${base(p.base_url)}/fine_tuning/jobs/${j.provider_job_id}`, { headers: { Authorization: `Bearer ${p.api_key}` } });
      const t = await r.text();
      if (!r.ok) return json({ error: `(${r.status}) ${t.slice(0, 400)}` }, 400);
      const s = JSON.parse(t);
      const { data: row } = await db.from("ai_finetune_jobs").update({
        status: s.status, fine_tuned_model: s.fine_tuned_model ?? j.fine_tuned_model,
        error: s.error?.message ?? null, updated_at: new Date().toISOString(),
      }).eq("id", j.id).select().single();
      return json({ ok: true, job: row });
    }

    if (action === "finetune_apply") {
      const { data: j } = await db.from("ai_finetune_jobs").select("*").eq("id", body.job_id).maybeSingle();
      if (!j?.fine_tuned_model) return json({ error: "O'qitilgan model hali tayyor emas" }, 400);
      await db.from("ai_providers").update({ model: j.fine_tuned_model, updated_at: new Date().toISOString() }).eq("id", j.provider_id);
      return json({ ok: true });
    }

    return json({ error: "Noma'lum amal" }, 400);
  } catch (e: any) {
    console.error("ai-admin", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
