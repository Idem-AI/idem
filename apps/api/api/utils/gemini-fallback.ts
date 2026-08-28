import logger from '../config/logger';

/**
 * Check if the error thrown by Gemini represents a "high demand", "rate limit", "overloaded", or "resource exhausted" error.
 */
export function isGeminiOverloadedError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode || error.code;
  
  const hasOverloadKeywords = 
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('exhausted') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable');

  const hasOverloadStatus = 
    status === 429 || 
    status === 503 || 
    status === '429' || 
    status === '503' ||
    status === 'RESOURCE_EXHAUSTED';

  return hasOverloadKeywords || hasOverloadStatus;
}

/**
 * Executes a primary function that makes a Gemini call.
 * If it fails due to high demand/overload, automatically catches the error,
 * logs a warning, and executes the fallback function.
 */
export async function withGeminiFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  modelName: string,
  fallbackModelName: string
): Promise<T> {
  try {
    return await primaryFn();
  } catch (error: any) {
    logger.warn(
      `Gemini model "${modelName}" failed (Error: ${error.message || error}). Attempting fallback to "${fallbackModelName}"...`,
      { error: error.message || error }
    );
    try {
      return await fallbackFn();
    } catch (fallbackError: any) {
      logger.error(
        `Fallback model "${fallbackModelName}" also failed: ${fallbackError.message || fallbackError}`,
        { error: fallbackError }
      );
      throw fallbackError;
    }
  }
}
