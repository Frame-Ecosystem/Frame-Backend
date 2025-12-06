import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import { LOG_DIR } from '@config';

// logs dir
const logDir: string = join(__dirname, LOG_DIR);

if (!existsSync(logDir)) {
  mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`);

/*
 * Log Level
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    logFormat,
  ),
  transports: [
    // debug log setting
    new winstonDaily({
      level: 'debug',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir + '/debug', // log file /logs/debug/*.log in save
      filename: `%DATE%.log`,
      maxFiles: 30, // 30 Days saved
      json: false,
      zippedArchive: true,
    }),
    // error log setting
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir + '/error', // log file /logs/error/*.log in save
      filename: `%DATE%.log`,
      maxFiles: 30, // 30 Days saved
      handleExceptions: true,
      json: false,
      zippedArchive: true,
    }),
  ],
});

// Security audit logger for authentication events
const securityLogFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

const securityLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    securityLogFormat,
  ),
  transports: [
    new winstonDaily({
      level: 'warn',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir + '/security',
      filename: `%DATE%.log`,
      maxFiles: 90, // Keep security logs for 90 days
      json: true,
      zippedArchive: true,
    }),
  ],
});

// Add console output for security logger in development
securityLogger.add(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [SECURITY] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      }),
    ),
  }),
);

// Security event types for structured logging
type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'TOKEN_REFRESH_SUCCESS'
  | 'TOKEN_REFRESH_FAILED'
  | 'TOKEN_REUSE_DETECTED'
  | 'INVALID_TOKEN'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'SUSPICIOUS_ACTIVITY';

interface SecurityEventData {
  event: SecurityEventType;
  userId?: string;
  ip?: string;
  userAgent?: string;
  jti?: string;
  reason?: string;
  [key: string]: unknown;
}

// Log security events with structured data
const logSecurityEvent = (data: SecurityEventData): void => {
  const { event, ...meta } = data;
  const level = ['TOKEN_REUSE_DETECTED', 'SUSPICIOUS_ACTIVITY', 'INVALID_TOKEN'].includes(event) ? 'error' : 'warn';
  securityLogger.log(level, event, meta);
};

logger.add(
  new winston.transports.Console({
    format: winston.format.combine(winston.format.splat(), winston.format.colorize()),
  }),
);

const stream = {
  write: (message: string) => {
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  },
};

export { logger, stream, securityLogger, logSecurityEvent, SecurityEventType, SecurityEventData };
