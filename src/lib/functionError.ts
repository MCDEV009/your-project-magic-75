/**
 * supabase.functions.invoke() xatolarida faqat
 * "Edge Function returned a non-2xx status code" qaytadi.
 * Bu yordamchi javob tanasidagi haqiqiy xato matnini va status kodini oladi.
 */
export interface FunctionErrorInfo {
  status: number | null;
  message: string;
  retryAfter: number | null;
  isRateLimit: boolean;
}

export async function readFunctionError(error: unknown): Promise<FunctionErrorInfo> {
  const fallback = (error as { message?: string })?.message || 'Noma\u2019lum xatolik';
  const ctx = (error as { context?: unknown })?.context as Response | undefined;
  let status: number | null = null;
  let message = fallback;
  let retryAfter: number | null = null;

  if (ctx && typeof ctx === 'object' && 'status' in ctx) {
    status = (ctx as Response).status ?? null;
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) message = String(body.error);
      if (typeof body?.retry_after === 'number') retryAfter = body.retry_after;
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text) message = text.slice(0, 300);
      } catch {
        /* ignore */
      }
    }
    if (retryAfter === null) {
      const header = Number((ctx as Response).headers?.get?.('retry-after'));
      if (Number.isFinite(header) && header > 0) retryAfter = Math.ceil(header);
    }
  }

  const isRateLimit = status === 429 || /rate limit|limit/i.test(message);
  if (status === 401) message = 'Sessiya tugagan. Qaytadan tizimga kiring.';
  if (status === 403 && !message) message = 'Bu amal uchun admin huquqi kerak.';

  return { status, message, retryAfter, isRateLimit };
}
