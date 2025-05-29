import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { connectToDatabase } from '@/lib/db';
import { logger } from '@/lib/api/services/logging';
import { PrometheusMetrics } from '@/lib/api/services/metrics';

const metrics = new PrometheusMetrics();

export async function GET(request: NextRequest) {
  const authError = await validateApiKey(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const stats = await metrics.collect();
    
    return NextResponse.json({
      success: true,
      data: {
        requests: {
          total: stats.totalRequests,
          success: stats.successfulRequests,
          failed: stats.failedRequests,
          latency: stats.averageLatency
        },
        fulfillment: {
          pending: stats.pendingOrders,
          processing: stats.processingOrders,
          completed: stats.completedOrders,
          failed: stats.failedOrders
        },
        providers: stats.providerMetrics,
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Metrics collection failed', { error });
    return NextResponse.json({
      success: false,
      error: 'Failed to collect metrics'
    }, { 
      status: 500 
    });
  }
}