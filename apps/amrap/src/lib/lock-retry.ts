/**
 * Supabase auth-js uses navigator.locks; concurrent getSession/onAuthStateChange can race and
 * cause "Lock broken by another request with the 'steal' option" (especially on Safari).
 * Wrap auth-touching RPCs (create_session, join_session) with withLockRetry so they retry
 * instead of failing or hanging when the lock is contended.
 */

export const LOCK_ABORT_MSG = "Lock broken by another request with the 'steal' option";

export function isLockAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    return e.name === 'AbortError' && e.message.includes(LOCK_ABORT_MSG);
  }
  return false;
}

export function isLockAbortInResult(result: {
  error?: { message?: string } | null;
}): boolean {
  return !!result.error?.message?.includes(LOCK_ABORT_MSG);
}

export async function withLockRetry<
  T extends { data: unknown; error: { message?: string } | null },
>(fn: () => PromiseLike<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (isLockAbortInResult(result) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }
      return result;
    } catch (e) {
      if (isLockAbortError(e) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Retry exhausted');
}
