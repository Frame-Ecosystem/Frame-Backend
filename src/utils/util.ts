import { ConflictException } from '@exceptions/HttpException';

/**
 * @method isEmpty
 * @param {String | Number | Object} value
 * @returns {Boolean} true & false
 * @description this value is Empty Check
 */
export const isEmpty = (value: string | number | object): boolean => {
  if (value === null) {
    return true;
  } else if (typeof value !== 'number' && value === '') {
    return true;
  } else if (typeof value === 'undefined' || value === undefined) {
    return true;
  } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
    return true;
  } else {
    return false;
  }
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
  const { password, refreshTokens, ...safeFields } = plainObj;
  void password;
  void refreshTokens;
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
