import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id) return json({ error: "session_id required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "auth_required" }, 401);

    const admin = createClient(url, service);
    const { data: session, error } = await admin.from("live_sessions").select("*").eq("id", session_id).single();
    if (error || !session) return json({ error: "not_found" }, 404);

    // authorization: host or admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (session.host_user_id !== uid && !isAdmin) return json({ error: "forbidden" }, 403);

    if (session.status === "ended") return json({ error: "already_ended" }, 400);

    const now = new Date();
    const ends = new Date(now.getTime() + (session.duration_seconds ?? 5400) * 1000);
    const { data: updated, error: upErr } = await admin
      .from("live_sessions")
      .update({ status: "running", starts_at: now.toISOString(), ends_at: ends.toISOString() })
      .eq("id", session_id)
      .select()
      .single();
    if (upErr) throw upErr;

    return json({ success: true, session: updated });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}