import { customLogger as logger } from '@/lib/api/services/logging';
import { UnauthorizedError, ForbiddenError } from '@/types/errors';

export interface AppErrorOptions {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: any;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor({ message, code = 'INTERNAL_ERROR', statusCode = 500, details }: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (error: unknown, context: string) => {
  // Get current user information
  const user = process.env.CURRENT_USER || 'system';
  const timestamp = new Date().toISOString();

  // Handle specific error types
  if (error instanceof UnauthorizedError) {
    logger.security('Unauthorized access attempt', {
      context,
      error: error.message,
      user,
      timestamp
    });
    return new AppError({
      message: error.message,
      code: 'UNAUTHORIZED',
      statusCode: 401
    });
  }

  if (error instanceof ForbiddenError) {
    logger.security('Forbidden access attempt', {
      context,
      error: error.message,
      user,
      timestamp
    });
    return new AppError({
      message: error.message,
      code: 'FORBIDDEN',
      statusCode: 403
    });
  }

  if (error instanceof AppError) {
    logger.error('Application error occurred', {
      context,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details
      },
      user,
      timestamp
    });
    return error;
  }

  // Handle unknown errors
  const unknownError = new AppError({
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    statusCode: 500
  });

  logger.error('Unhandled error occurred', {
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : String(error),
    user,
    timestamp
  });

  return unknownError;
};

export const handleRequestError = (error: unknown, context: string) => {
  const appError = handleError(error, context);
  
  return {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      timestamp: appError.timestamp
    }
  };
};