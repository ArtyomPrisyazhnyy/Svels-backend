type ErrWithCode = { code?: string; message?: string };

export function isPgTransientConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as ErrWithCode;
  const code = err.code;
  if (code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
    return true;
  }

  const message = err.message?.toLowerCase() ?? '';
  if (
    message.includes('connection terminated due to connection timeout') ||
    message.includes('timeout expired') ||
    message.includes('connection timeout')
  ) {
    return true;
  }

  return false;
}

/** One retry for safe read paths after transient pool / DNS failures. */
export async function withIdempotentReadRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isPgTransientConnectionError(error)) {
      throw error;
    }
    return await operation();
  }
}
