import winston from 'winston';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { auth } from '@/auth';

const redis = new Redis({
  url: `https://${process.env.UPSTASH_REDIS_URL}`,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const getCurrentTimestamp = () => new Date().toISOString();

const getCurrentUser = async () => {
  const session = await auth();
  return {
    timestamp: getCurrentTimestamp(),
    user: session?.user?.id || 'anonymous',
  };
};

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.metadata({
    fillWith: ['user', 'timestamp', 'service'],
  }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'api',
  },
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

async function storeLog(logEntry: Record<string, any>) {
  try {
    const key = `logs:${getCurrentTimestamp()}:${crypto.randomUUID()}`;
    await redis.set(key, JSON.stringify(logEntry), { ex: 86400 });
  } catch (error) {
    logger.error('Failed to store log in Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const customLogger = {
  info: async (message: string, meta: Record<string, any> = {}) => {
    const logEntry = {
      message,
      ...(await getCurrentUser()),
      ...meta,
    };
    logger.info(message, logEntry);
    await storeLog(logEntry);
  },

  error: async (message: string, error?: Error | unknown, meta: Record<string, any> = {}) => {
    const logEntry = {
      message,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      ...(await getCurrentUser()),
      ...meta,
    };
    logger.error(message, logEntry);
    await storeLog(logEntry);
  },

  security: async (event: string, details: Record<string, any>) => {
    const logEntry = {
      event,
      details,
      ...(await getCurrentUser()),
    };
    logger.warn('Security Event', logEntry);
    await storeLog(logEntry);
  },

  audit: async (action: string, data: Record<string, any>) => {
    const logEntry = {
      action,
      data,
      ...(await getCurrentUser()),
    };
    logger.info('Audit Log', logEntry);
    await storeLog(logEntry);
  },
};

export const loggerMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  const logRequest = async () => {
    const logEntry = {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      ...(await getCurrentUser()),
    };
    await customLogger.info('Request received', logEntry);
  };

  const logResponse = async () => {
    const duration = Date.now() - startTime;
    const logEntry = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ...(await getCurrentUser()),
    };
    await customLogger.info('Response sent', logEntry);
  };

  await logRequest();

  res.on('finish', async () => {
    await logResponse();
  });

  next();
};

export { logger };
