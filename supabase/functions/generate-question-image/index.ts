import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

type ImageEvent = {
  type?: string;
  b64_json?: string;
  error?: { message?: string };
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readFinalImage(response: Response): Promise<string> {
  if (!response.body) throw new Error("AI rasm javobi bo'sh qaytdi");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finalImage = "";
  let streamError = "";

  const consume = (block: string) => {
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length || dataLines.join("") === "[DONE]") return;
    let payload: ImageEvent;
    try {
      payload = JSON.parse(dataLines.join("\n")) as ImageEvent;
    } catch {
      return;
    }
    if (eventName === "error" || payload.type === "error") {
      streamError = payload.error?.message || "AI rasm yaratishni rad etdi";
      return;
    }
    if ((eventName === "image_generation.completed" || payload.type === "image_generation.completed") && payload.b64_json) {
      finalImage = payload.b64_json;
    }
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += chunk.value;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    blocks.forEach(consume);
  }
  if (buffer.trim()) consume(buffer);
  if (streamError) throw new Error(streamError);
  if (!finalImage) throw new Error("AI rasmni yakunlamadi");
  return finalImage;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Sessiya topilmadi" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!url || !anonKey || !serviceKey || !apiKey) {
      return jsonResponse({ error: "Rasm xizmati sozlanmagan" }, 500);
    }

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Sessiya tugagan" }, 401);

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin", "editor"]);
    if (!roles?.length) return jsonResponse({ error: "Bu amal uchun admin huquqi kerak" }, 403);

    const body = await req.json().catch(() => null) as { prompt?: unknown; questionId?: unknown } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : "";
    if (prompt.length < 10 || prompt.length > 3000) {
      return jsonResponse({ error: "Rasm tavsifi 10–3000 belgi bo'lishi kerak" }, 400);
    }

    const examPrompt = [
      "Create a precise educational exam diagram based on this specification:",
      prompt,
      "Use a clean white background, crisp black lines, high contrast, centered composition.",
      "Do not include answer choices, solutions, watermarks, logos, decorative scenery, or explanatory paragraphs.",
      "Include only labels explicitly required by the specification. Keep geometry and scientific relationships accurate.",
    ].join("\n");

    const makeRequest = () => fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: examPrompt,
        size: "1024x1024",
        quality: "medium",
        stream: true,
        partial_images: 1,
      }),
    });

    let upstream = await makeRequest();
    for (let attempt = 1; attempt <= 2 && (upstream.status === 429 || upstream.status >= 500); attempt++) {
      const retryAfter = Number(upstream.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 30000)
        : 1500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      upstream = await makeRequest();
    }

    if (!upstream.ok) {
      const details = await upstream.text().catch(() => "");
      console.error(`Image gateway failed [${upstream.status}]: ${details}`);
      const safeMessage = (() => {
        try {
          const parsed = JSON.parse(details) as { message?: string; error?: { message?: string } };
          return parsed.message || parsed.error?.message;
        } catch {
          return undefined;
        }
      })();
      return jsonResponse({ error: safeMessage || `AI rasm xizmati xatosi (${upstream.status})` }, upstream.status);
    }

    const imageBase64 = await readFinalImage(upstream);
    const bytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
    const admin = createClient(url, serviceKey);
    const objectPath = `ai/${questionId || crypto.randomUUID()}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await admin.storage
      .from("question-images")
      .upload(objectPath, bytes, { contentType: "image/png", cacheControl: "31536000", upsert: false });
    if (uploadError) throw new Error(`Rasmni saqlashda xatolik: ${uploadError.message}`);

    const { data: signed, error: signError } = await admin.storage
      .from("question-images")
      .createSignedUrl(objectPath, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed?.signedUrl) throw new Error("Rasm manzilini yaratib bo'lmadi");

    return jsonResponse({ image_url: signed.signedUrl, path: objectPath }, 200);
  } catch (error) {
    console.error("generate-question-image error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Rasm yaratishda noma'lum xatolik" }, 500);
  }
});