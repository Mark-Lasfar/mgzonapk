import { RedisClient } from './redis';
import { logger } from './logging';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface ErrorEvent {
  error: Error | string;
  context?: Record<string, any>;
  timestamp: Date;
}

export class ObservabilityService {
  private static instance: ObservabilityService;

  private constructor() {
    logger.info('ObservabilityService initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  static getInstance(): ObservabilityService {
    if (!this.instance) {
      this.instance = new ObservabilityService();
    }
    return this.instance;
  }

  async recordMetric(metric: Metric): Promise<void> {
    try {
      const metricKey = `metric:${metric.name}:${Date.now()}`;
      await RedisClient.set(metricKey, {
        ...metric,
        timestamp: metric.timestamp.toISOString(),
      }, { ex: 86400 }); // 24 hours TTL
      logger.info('Metric recorded', {
        name: metric.name,
        value: metric.value,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to record metric', {
        metric,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  async recordError(event: ErrorEvent): Promise<void> {
    try {
      const errorKey = `error:${Date.now()}`;
      await RedisClient.set(errorKey, {
        error: event.error.toString(),
        context: event.context,
        timestamp: event.timestamp.toISOString(),
      }, { ex: 604800 }); // 7 days TTL
      logger.error('Error recorded', {
        error: event.error,
        context: event.context,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to record error', {
        event,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getMetrics(name: string, start: Date, end: Date): Promise<Metric[]> {
    try {
      // Upstash Redis doesn't support SCAN, so we use a simplified approach
      const metrics: Metric[] = [];
      // In production, implement a proper key retrieval strategy
      logger.info('Metrics retrieved', {
        name,
        start: start.toISOString(),
        end: end.toISOString(),
        timestamp: new Date().toISOString(),
      });
      return metrics.filter(
        (m) => new Date(m.timestamp) >= start && new Date(m.timestamp) <= end
      );
    } catch (error) {
      logger.error('Failed to retrieve metrics', {
        name,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      return [];
    }
  }
}