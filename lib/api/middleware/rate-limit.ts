import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import ApiKeyModel from '@/lib/db/models/api-key.model';
import SellerModel from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const RATE_LIMIT_CONFIGS = {
  free: { requests: 100, window: 3600 }, // 100 requests per hour
  Basic: { requests: 1000, window: 3600 }, // 1000 requests per hour
  Pro: { requests: 10000, window: 3600 }, // 10000 requests per hour
  VIP: { requests: 100000, window: 3600 }, // 100000 requests per hour
};

export async function rateLimit(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'API key required',
      }),
      { status: 401 }
    );
  }

  const key = `rate-limit:${apiKey}`;
  const now = Date.now();

  try {
    await connectToDatabase();
    const apiKeyDoc = await ApiKeyModel.findOne({ 
      key: apiKey,
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    });
    if (!apiKeyDoc) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Invalid or expired API key' }),
        { status: 401 }
      );
    }

    const seller = await SellerModel.findOne({ apiKeys: apiKeyDoc._id });
    const plan = (seller?.subscription.plan || 'Basic') as keyof typeof RATE_LIMIT_CONFIGS;
    const config = RATE_LIMIT_CONFIGS[plan];

    const requests = await redis.zcount(key, now - (config.window * 1000), now);

    if (requests >= config.requests) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          reset: await redis.zscore(key, 'window_expires'),
        }),
        { status: 429 }
      );
    }

    await redis.zadd(key, { score: now, member: Date.now().toString() });
    await redis.expire(key, config.window);

    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.requests.toString());
    headers.set('X-RateLimit-Remaining', (config.requests - requests - 1).toString());
    headers.set('X-RateLimit-Reset', (now + config.window * 1000).toString());

    return { headers };
  } catch (error) {
    console.error('Rate limiting error:', error);
    return null;
  }
}