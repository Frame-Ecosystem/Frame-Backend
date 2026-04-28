import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import { createHash } from 'crypto';
import { LOG_DIR } from '@config';

// logs dir
const logDir: string = join(__dirname, LOG_DIR);

if (!existsSync(logDir)) {
  mkdirSync(logDir);
}

/**
 * Hash IP address for GDPR compliance
 * Uses SHA-256 with a stable salt to anonymize IPs while maintaining
 * consistent correlation across the application lifecycle.
 * The salt rotates with the application's secret key rotation.
 * @param ip - The IP address to hash
 * @returns Hashed IP (first 16 chars of SHA-256)
 */
const hashIp = (ip: string | undefined): string | undefined => {
  if (!ip) return undefined;
  const salt = process.env.IP_HASH_SALT || process.env.SECRET_KEY || 'frame-beauty-default-salt';
  const hash = createHash('sha256').update(`${salt}:${ip}`).digest('hex');
  return hash.substring(0, 16); // First 16 chars is sufficient for correlation
};

const redactSensitive = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://<redacted>@')
    .replace(/(SECRET_KEY|REFRESH_TOKEN_SECRET|SMTP_PASS|R2_SECRET_ACCESS_KEY|GOOGLE_CLIENT_SECRET)=([^&\s]+)/gi, '$1=<redacted>')
    .replace(/(password|token|secret|api[_-]?key)(["'\s:=]+)([^"',\s}]+)/gi, '$1$2<redacted>');
};

const redactMeta = (meta: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, redactSensitive(value)]));

const redactFormat = winston.format(info => {
  info.message = redactSensitive(info.message);
  Object.entries(info).forEach(([key, value]) => {
    if (key !== 'level' && key !== 'timestamp') {
      info[key] = redactSensitive(value);
    }
  });
  return info;
});

// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${redactSensitive(message)}`);

/*
 * Log Level
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const logger = winston.createLogger({
  format: winston.format.combine(
    redactFormat(),
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
  const safeMeta = redactMeta(meta);
  return `${timestamp} ${level}: ${redactSensitive(message)} ${Object.keys(safeMeta).length ? JSON.stringify(safeMeta) : ''}`;
});

const securityLogger = winston.createLogger({
  format: winston.format.combine(
    redactFormat(),
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
        const safeMeta = redactMeta(meta);
        return `${timestamp} [SECURITY] ${level}: ${redactSensitive(message)} ${Object.keys(safeMeta).length ? JSON.stringify(safeMeta) : ''}`;
      }),
    ),
  }),
);

// Security event types for structured logging
type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'OAUTH_LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SIGNUP_INITIATED'
  | 'SIGNUP_COMPLETED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'TOKEN_REFRESH_SUCCESS'
  | 'TOKEN_REFRESH_FAILED'
  | 'TOKEN_REUSE_DETECTED'
  | 'INVALID_TOKEN'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'USER_OFFLINE'
  | 'USER_ONLINE'
  | 'ADMIN_ACCESS_DENIED'
  | 'CLIENT_ACCESS_DENIED'
  | 'LOUNGE_ACCESS_DENIED'
  | 'AGENT_ACCESS_DENIED'
  | 'ADMIN_LOUNGE_ACCESS_DENIED'
  | 'ADMIN_LOUNGE_CLIENT_ACCESS_DENIED'
  | 'ADMIN_LOUNGE_AGENT_ACCESS_DENIED'
  | 'ADMIN_LOUNGE_CLIENT_AGENT_ACCESS_DENIED'
  | 'CLIENT_ADMIN_ACCESS_DENIED';

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
// IP addresses are hashed for GDPR compliance
const logSecurityEvent = (data: SecurityEventData): void => {
  const { event, ip, ...rest } = data;
  // Hash IP for privacy compliance before logging
  const sanitizedData = {
    ...rest,
    ipHash: hashIp(ip), // Store hashed IP instead of plain IP
  };
  const level = ['TOKEN_REUSE_DETECTED', 'SUSPICIOUS_ACTIVITY', 'INVALID_TOKEN'].includes(event) ? 'error' : 'warn';
  securityLogger.log(level, event, sanitizedData);
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
