import { BadRequestException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

/**
 * Check whether a value is empty (null, undefined, empty string, or empty object).
 */
export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string' && value === '') return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
};

/**
 * Strip sensitive fields from any object before sending to client.
 * Removes: password, refreshTokens
 * @param obj - The object (can be Mongoose document or plain object)
 * @returns Object without sensitive fields
 */
export const stripSensitiveFields = <T extends Record<string, any>>(obj: T): Partial<T> => {
  let plainObj: Record<string, unknown>;
  if (typeof obj === 'object' && obj !== null && 'toObject' in obj && typeof obj.toObject === 'function') {
    plainObj = obj.toObject();
  } else {
    plainObj = obj as unknown as Record<string, unknown>;
  }
  const { password: _pw, refreshTokens: _rt, ...safeFields } = plainObj;
  return safeFields as Partial<T>;
};

/**
 * MongoDB Duplicate Key Error Code
 */
const MONGO_DUPLICATE_KEY_ERROR = 11000;

/**
 * Handle MongoDB duplicate key errors (code 11000) with user-friendly messages
 * This handles race conditions where the unique index catches duplicates
 * that weren't detected by the pre-check queries
 * @param error - The error from MongoDB
 * @throws ConflictException with appropriate message based on which field caused the conflict
 * @returns false if not a duplicate key error (caller should handle differently)
 */
export const handleMongoDBDuplicateKeyError = (error: any): never | false => {
  if (error.code !== MONGO_DUPLICATE_KEY_ERROR) {
    return false;
  }

  // Extract the field name from the error message or keyPattern
  const keyPattern = error.keyPattern || {};
  const duplicateField = Object.keys(keyPattern)[0];

  switch (duplicateField) {
    case 'email':
      throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
    case 'phoneNumber':
      throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
    default:
      throw new ConflictException('A record with this information already exists', 'DUPLICATE_ENTRY');
  }
};

/**
 * Handle common Mongoose/MongoDB errors with user-friendly messages.
 * Converts ValidationError, CastError (ObjectId), and duplicate key errors
 * into appropriate HTTP exceptions.
 *
 * @param error - The caught error
 * @param context - A short label for log messages (e.g. 'create lounge service')
 * @param options - Optional overrides for error messages
 * @throws BadRequestException | ConflictException | InternalServerException
 */
export const handleMongooseError = (
  error: any,
  context: string,
  options: {
    validationMessage?: string;
    duplicateMessage?: string;
    castMessage?: string;
    fallbackMessage?: string;
    logMeta?: Record<string, any>;
  } = {},
): never => {
  const {
    validationMessage = 'Invalid data provided. Please check all required fields.',
    duplicateMessage = 'A record with this information already exists.',
    castMessage = 'Invalid ID format',
    fallbackMessage = 'An unexpected error occurred. Please try again later.',
    logMeta = {},
  } = options;

  if (error.name === 'ValidationError') {
    logger.error(`${context} validation error: ${error.message}`, { ...logMeta, stack: error.stack });
    throw new BadRequestException(validationMessage, 'VALIDATION_ERROR');
  }

  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    logger.error(`${context} invalid ID format`, { ...logMeta, stack: error.stack });
    throw new BadRequestException(castMessage, 'INVALID_ID_FORMAT');
  }

  if (error.code === MONGO_DUPLICATE_KEY_ERROR) {
    logger.error(`${context} duplicate key error: ${error.message}`, { ...logMeta, stack: error.stack });
    throw new ConflictException(duplicateMessage, 'DUPLICATE_KEY_ERROR');
  }

  logger.error(`${context} error: ${error.message}`, { ...logMeta, stack: error.stack });
  throw new InternalServerException(fallbackMessage);
};
