// Resolves which AI provider (OpenAI-compatible) to use: the admin-selected
// active provider from the database, otherwise the env-configured fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface AIProvider {
  url: string; // full chat/completions URL
  key: string;
  model: string;
  name: string;
}

export function chatUrl(baseUrl: string): string {
  const b = baseUrl.trim().replace(/\/+$/, "");
  return b.endsWith("/chat/completions") ? b : `${b}/chat/completions`;
}

export async function resolveAIProvider(): Promise<AIProvider> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin
      .from("ai_providers")
      .select("name, base_url, api_key, model")
      .eq("is_active", true)
      .maybeSingle();
    if (data?.api_key && data?.base_url && data?.model) {
      return { url: chatUrl(data.base_url), key: data.api_key, model: data.model, name: data.name };
    }
  } catch (e) {
    console.error("resolveAIProvider db error", e);
  }
  const gemini = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (gemini) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: gemini,
      model: "gemini-3.5-flash",
      name: "Gemini",
    };
  }
  const groq = Deno.env.get("GROQ_API_KEY");
  if (groq) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      model: "openai/gpt-oss-120b",
      name: "Groq",
    };
  }
  throw new Error("AI provayder sozlanmagan: admin panelda provayder qo'shing");
}
