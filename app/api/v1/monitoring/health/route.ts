import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { logger } from '@/lib/api/services/logging';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency?: number }> = {};

  try {
    // Check database connection
    try {
      await connectToDatabase();
      checks.database = { 
        status: 'healthy',
        latency: Date.now() - startTime 
      };
    } catch (error) {
      checks.database = { status: 'unhealthy' };
      logger.error('Database health check failed', { error });
    }

    // Check fulfillment providers
    const providers = ['shipbob', 'amazon', 'aliexpress', '4px'];
    const fulfillmentService = new UnifiedFulfillmentService([
      // ... provider configurations
    ]);

    for (const provider of providers) {
      try {
        const providerStart = Date.now();
        await fulfillmentService.checkProviderHealth(provider);
        checks[provider] = {
          status: 'healthy',
          latency: Date.now() - providerStart
        };
      } catch (error) {
        checks[provider] = { status: 'unhealthy' };
        logger.error(`${provider} health check failed`, { error });
      }
    }

    const overallStatus = Object.values(checks)
      .every(check => check.status === 'healthy')
      ? 'healthy'
      : 'degraded';

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });

  } catch (error) {
    logger.error('Health check failed', { error });
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      error: error.message
    }, { 
      status: 500 
    });
  }
}