import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '../services/rate-limiter';
import { logger } from '../services/logging';

// Update the timestamp constant
const CURRENT_TIMESTAMP = '2025-04-28T02:43:31Z'
const CURRENT_USER = 'Mark-Lasfar'

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (request: NextRequest) => string;
}

const defaultKeyGenerator = (request: NextRequest): string => {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const path = request.nextUrl.pathname;
  return `${ip}:${path}`;
};

export function rateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowSeconds,
    keyGenerator = defaultKeyGenerator
  } = config;

  return async (request: NextRequest) => {
    try {
      const key = keyGenerator(request);
      
      const result = await RateLimiter.checkRateLimit(
        key,
        maxRequests,
        windowSeconds
      );

      // Add rate limit headers
      const headers = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.getTime().toString(),
      };

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          maxRequests,
          windowSeconds,
          timestamp: CURRENT_TIMESTAMP,
          user: CURRENT_USER
        });

        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Too many requests',
            retryAfter: result.resetTime
          }),
          {
            status: 429,
            headers: {
              ...headers,
              'Retry-After': Math.ceil((result.resetTime.getTime() - Date.now()) / 1000).toString()
            }
          }
        );
      }

      // Continue with the request
      const response = await fetch(request);
      
      // Add rate limit headers to the response
      const finalResponse = new NextResponse(response.body, response);
      Object.entries(headers).forEach(([key, value]) => {
        finalResponse.headers.set(key, value);
      });

      return finalResponse;

    } catch (error) {
      logger.error(new Error('Rate limiter middleware error'), {
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });

      // Fail open
      return fetch(request);
    }
  };
}