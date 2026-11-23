import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SECRET = Deno.env.get("CAPTCHA_SECRET") ?? "";
const TTL_MS = 5 * 60 * 1000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rand(min: number, max: number) {
  const b = new Uint32Array(1); crypto.getRandomValues(b);
  return min + (b[0] % (max - min + 1));
}

async function challenge() {
  const ops = ["+", "-", "×"] as const;
  const op = ops[rand(0, 2)];
  let a = rand(2, 19), b = rand(2, 9);
  if (op === "-" && b > a) [a, b] = [b, a];
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const exp = Date.now() + TTL_MS;
  const nonce = crypto.randomUUID();
  const sig = await sign(`${exp}.${nonce}.${answer}`);
  return { question: `${a} ${op} ${b} = ?`, token: `${exp}.${nonce}.${sig}` };
}

async function verify(token: unknown, answer: unknown) {
  if (typeof token !== "string" || (typeof answer !== "string" && typeof answer !== "number")) return false;
  const [expStr, nonce, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !nonce || !sig || exp < Date.now()) return false;
  const ans = String(answer).trim();
  if (!/^-?\d{1,4}$/.test(ans)) return false;
  const expected = await sign(`${exp}.${nonce}.${Number(ans)}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!SECRET) return json({ error: "Captcha sozlanmagan" }, 500);
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "challenge") return json(await challenge());

    if (action === "verify") {
      const ok = await verify(body.token, body.answer);
      return ok ? json({ ok: true }) : json({ error: "Tekshiruv javobi noto'g'ri yoki eskirgan. Qayta urinib ko'ring." }, 400);
    }

    if (action === "feedback") {
      if (body.website) return json({ ok: true }); // honeypot: botlarga jim javob
      if (!(await verify(body.token, body.answer))) {
        return json({ error: "Tekshiruv javobi noto'g'ri yoki eskirgan. Qayta urinib ko'ring." }, 400);
      }
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (message.length < 3 || message.length > 2000) return json({ error: "Xabar 3–2000 belgi bo'lishi kerak." }, 400);
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) || null : null;
      const email = typeof body.email === "string" ? body.email.trim().slice(0, 255) || null : null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email noto'g'ri." }, 400);
      const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;

      const url = Deno.env.get("SUPABASE_URL")!;
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      let userId: string | null = null;
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data } = await admin.auth.getUser(auth.slice(7));
        userId = data.user?.id ?? null;
      }
      const { error } = await admin.from("feedback").insert({ user_id: userId, name, email, message, page });
      if (error) { console.error("feedback insert", error); return json({ error: "Saqlab bo'lmadi, keyinroq urinib ko'ring." }, 500); }
      return json({ ok: true });
    }

    return json({ error: "Noma'lum amal" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Server xatosi" }, 500);
  }
});
