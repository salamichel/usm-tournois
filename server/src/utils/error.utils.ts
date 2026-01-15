import { AppError } from '../middlewares/error.middleware';

/**
 * Standard error handler for controllers
 * - Logs the error with context
 * - Preserves AppError instances (which have proper status codes and messages)
 * - Wraps unknown errors in AppError with a fallback message
 *
 * @param error - The caught error
 * @param context - Description of what operation failed (e.g., 'creating tournament')
 * @param fallbackMessage - User-facing error message if not an AppError
 * @param statusCode - HTTP status code for non-AppError errors (default: 500)
 */
export function handleControllerError(
  error: unknown,
  context: string,
  fallbackMessage?: string,
  statusCode: number = 500
): never {
  // Log the error with context for debugging
  console.error(`Error ${context}:`, error);

  // If it's already an AppError with proper status and message, preserve it
  if (error instanceof AppError) {
    throw error;
  }

  // Otherwise, wrap it in an AppError with the fallback message
  const message = fallbackMessage || `Error ${context}`;
  throw new AppError(message, statusCode);
}

/**
 * Shorthand for common error patterns
 */
export const ErrorHandlers = {
  /**
   * Handle "not found" errors (404)
   */
  notFound: (resource: string, id?: string) => {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    throw new AppError(message, 404);
  },

  /**
   * Handle validation errors (400)
   */
  validation: (message: string) => {
    throw new AppError(message, 400);
  },

  /**
   * Handle unauthorized errors (401)
   */
  unauthorized: (message: string = 'Unauthorized access') => {
    throw new AppError(message, 401);
  },

  /**
   * Handle forbidden errors (403)
   */
  forbidden: (message: string = 'Access forbidden') => {
    throw new AppError(message, 403);
  },
};
