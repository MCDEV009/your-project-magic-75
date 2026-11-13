/** Safely reads `.message` from an unknown thrown value (Error or plain object like PostgrestError). */
export function errorMessage(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    return m as string | undefined;
  }
  return undefined;
}
