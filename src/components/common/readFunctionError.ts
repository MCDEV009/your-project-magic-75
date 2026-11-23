export async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const b = await ctx.clone().json(); if (b?.error) return String(b.error); } catch { /* ignore */ }
  }
  return fallback;
}
