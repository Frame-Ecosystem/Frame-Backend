/**
 * Custom HTTP Exception for consistent error handling
 * Provides structured error responses with optional error codes and data
 */
export class HttpException extends Error {
  public status: number;
  public message: string;
  public code?: string;
  public details?: Record<string, unknown>;
  public isOperational: boolean;

  /**
   * @param status - HTTP status code (e.g., 400, 401, 404, 500)
   * @param message - User-friendly error message (shown to client)
   * @param code - Optional error code for client-side handling (e.g., 'AUTH_EXPIRED', 'VALIDATION_ERROR')
   * @param details - Optional additional error details (for debugging, not exposed to client in production)
   */
  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.message = message;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, HttpException.prototype);
  }

  /**
   * Convert to JSON for API response
   */
  public toJSON(): Record<string, unknown> {
    return {
      status: this.status,
      message: this.message,
      ...(this.code && { code: this.code }),
    };
  }
}

// Common HTTP error factory methods for convenience
export class BadRequestException extends HttpException {
  constructor(message = 'Bad request', code?: string, details?: Record<string, unknown>) {
    super(400, message, code || 'BAD_REQUEST', details);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized', code?: string, details?: Record<string, unknown>) {
    super(401, message, code || 'UNAUTHORIZED', details);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden', code?: string, details?: Record<string, unknown>) {
    super(403, message, code || 'FORBIDDEN', details);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not found', code?: string, details?: Record<string, unknown>) {
    super(404, message, code || 'NOT_FOUND', details);
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict', code?: string, details?: Record<string, unknown>) {
    super(409, message, code || 'CONFLICT', details);
  }
}

export class InternalServerException extends HttpException {
  constructor(message = 'Internal server error', code?: string, details?: Record<string, unknown>) {
    super(500, message, code || 'INTERNAL_ERROR', details);
  }
}
