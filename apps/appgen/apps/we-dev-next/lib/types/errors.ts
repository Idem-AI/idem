/**
 * Type definitions for error handling
 */

export interface HttpError extends Error {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}

export interface ApiError extends Error {
  cause?: string | { message?: string };
  error?: { message?: string };
  errors?: Array<{ responseBody?: string }>;
}

export interface FirebaseError extends Error {
  code?: string;
  details?: string;
}

export function isHttpError(error: Error): error is HttpError {
  return 'response' in error;
}

export function isApiError(error: Error): error is ApiError {
  return 'cause' in error || 'errors' in error;
}

export function isFirebaseError(error: Error): error is FirebaseError {
  return 'code' in error;
}
