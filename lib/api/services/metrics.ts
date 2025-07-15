import os from 'os';
import { adminFirestore } from '@/lib/firebase/admin';
import { logger } from '@/lib/api/services/logging';
import { Counter, Gauge, register } from 'prom-client';
import { IMetric, IMetricAggregation, MetricType } from '@/types/metrics';

export class MetricsService {
  private collection = adminFirestore.collection('metrics');

  async getMetrics(options: {
    type?: MetricType;
    from?: Date;
    to?: Date;
    userId?: string;
    source?: string;
    limit?: number;
  }): Promise<IMetric[]> {
    try {
      let query: FirebaseFirestore.Query = this.collection;

      if (options.type) {
        query = query.where('type', '==', options.type);
      }

      if (options.from) {
        query = query.where('timestamp', '>=', options.from);
      }

      if (options.to) {
        query = query.where('timestamp', '<=', options.to);
      }

      if (options.userId) {
        query = query.where('userId', '==', options.userId);
      }

      if (options.source) {
        query = query.where('source', '==', options.source);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          data.timestamp = data.timestamp.toDate();
        }
        return {
          id: doc.id,
          ...data,
        } as IMetric;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get metrics', { error: errorMessage });
      throw new Error(`Failed to get metrics: ${errorMessage}`);
    }
  }

  async saveMetric(metric: IMetric) {
    try {
      const { id, ...data } = metric;
      const result = await this.collection.add({
        ...data,
        timestamp: new Date(),
      });
      logger.info('Metric saved', { metricId: result.id, type: data.type });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save metric', { error: errorMessage });
      throw new Error(`Failed to save metric: ${errorMessage}`);
    }
  }

  async aggregateMetrics(options: {
    type: MetricType;
    interval: 'hour' | 'day' | 'week' | 'month';
    from?: Date;
    to?: Date;
  }): Promise<IMetricAggregation[]> {
    try {
      const metrics = await this.getMetrics(options);
      const groups = metrics.reduce((acc, metric) => {
        const date = metric.timestamp;
        if (!date) return acc;

        let key: string;
        switch (options.interval) {
          case 'hour':
            key = date.toISOString().slice(0, 13);
            break;
          case 'day':
            key = date.toISOString().slice(0, 10);
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().slice(0, 10);
            break;
          case 'month':
            key = date.toISOString().slice(0, 7);
            break;
        }

        if (!acc[key]) {
          acc[key] = {
            values: [],
            count: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
          };
        }

        acc[key].values.push(metric.value);
        acc[key].count++;
        acc[key].sum += metric.value;
        acc[key].min = Math.min(acc[key].min, metric.value);
        acc[key].max = Math.max(acc[key].max, metric.value);

        return acc;
      }, {} as Record<string, any>);

      return Object.entries(groups).map(([key, group]) => ({
        type: options.type,
        interval: options.interval,
        timestamp: new Date(key),
        value: group.sum,
        count: group.count,
        min: group.min === Infinity ? 0 : group.min,
        max: group.max === -Infinity ? 0 : group.max,
        avg: group.count > 0 ? group.sum / group.count : 0,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to aggregate metrics', { error: errorMessage });
      throw new Error(`Failed to aggregate metrics: ${errorMessage}`);
    }
  }

  async getRealtimeMetrics(type: MetricType): Promise<IMetric | null> {
    try {
      const snapshot = await this.collection
        .where('type', '==', type)
        .where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000))
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        logger.info('No realtime metrics found', { type });
        return null;
      }

      const data = snapshot.docs[0].data() as IMetric;
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        data.timestamp = data.timestamp.toDate();
      }
      return { id: snapshot.docs[0].id, ...data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get realtime metrics', { error: errorMessage });
      throw new Error(`Failed to get realtime metrics: ${errorMessage}`);
    }
  }
}

export const metricsService = new MetricsService();

export class PrometheusMetrics {
  private totalRequests: Counter;
  private successfulRequests: Counter;
  private failedRequests: Counter;
  private averageLatency: Gauge;
  private pendingOrders: Gauge;
  private processingOrders: Gauge;
  private completedOrders: Gauge;
  private failedOrders: Gauge;
  private providerMetrics: Counter;
  private webhookProcessed: Counter;
  private errors: Counter;
  private sellerRegistrations: Counter;

  constructor() {
    register.clear();

    this.totalRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route'],
    });

    this.successfulRequests = new Counter({
      name: 'http_requests_success',
      help: 'Total number of successful HTTP requests',
      labelNames: ['method', 'route'],
    });

    this.failedRequests = new Counter({
      name: 'http_requests_failed',
      help: 'Total number of failed HTTP requests',
      labelNames: ['method', 'route'],
    });

    this.averageLatency = new Gauge({
      name: 'http_request_latency_ms',
      help: 'Average request latency in milliseconds',
      labelNames: ['method', 'route'],
    });

    this.pendingOrders = new Gauge({
      name: 'fulfillment_orders_pending',
      help: 'Number of pending fulfillment orders',
      labelNames: ['provider'],
    });

    this.processingOrders = new Gauge({
      name: 'fulfillment_orders_processing',
      help: 'Number of processing fulfillment orders',
      labelNames: ['provider'],
    });

    this.completedOrders = new Gauge({
      name: 'fulfillment_orders_completed',
      help: 'Number of completed fulfillment orders',
      labelNames: ['provider'],
    });

    this.failedOrders = new Gauge({
      name: 'fulfillment_orders_failed',
      help: 'Number of failed fulfillment orders',
      labelNames: ['provider'],
    });

    this.providerMetrics = new Counter({
      name: 'fulfillment_provider_operations',
      help: 'Total operations per provider',
      labelNames: ['provider', 'operation'],
    });

    this.webhookProcessed = new Counter({
      name: 'webhook_processed_total',
      help: 'Total number of processed webhooks',
      labelNames: ['provider', 'eventType'],
    });

    this.errors = new Counter({
      name: 'application_errors_total',
      help: 'Total number of application errors',
      labelNames: ['context'],
    });

    this.sellerRegistrations = new Counter({
      name: 'seller_registrations_total',
      help: 'Total number of seller registrations',
      labelNames: ['status'],
    });
  }

  async recordRequest(method: string, route: string, success: boolean, latency: number) {
    this.totalRequests.inc({ method, route });
    if (success) {
      this.successfulRequests.inc({ method, route });
    } else {
      this.failedRequests.inc({ method, route });
    }
    this.averageLatency.set({ method, route }, latency);
  }

  async recordMetric(metric: { name: string; value: number; timestamp: Date; tags?: any }) {
    if (metric.name === 'shipment.created') {
      this.providerMetrics.inc({ provider: metric.tags?.provider, operation: 'create_shipment' }, metric.value);
    } else if (metric.name === 'shipment.tracked') {
      this.providerMetrics.inc({ provider: metric.tags?.provider, operation: 'track_shipment' }, metric.value);
    } else if (metric.name === 'webhook.processed') {
      this.webhookProcessed.inc({ provider: metric.tags?.provider, eventType: metric.tags?.eventType }, metric.value);
    }
  }

  async recordError(error: { error: string; context?: any; timestamp: Date }) {
    this.errors.inc({ context: error.context?.data || 'unknown' });
  }

  async recordSellerRegistration(status: 'success' | 'failed') {
    this.sellerRegistrations.inc({ status });
  }

  async collect() {
    try {
      return {
        totalRequests: this.totalRequests.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        successfulRequests: this.successfulRequests.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        failedRequests: this.failedRequests.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        averageLatency: this.averageLatency.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) / (this.averageLatency.get()?.values.length || 1) || 0,
        pendingOrders: this.pendingOrders.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        processingOrders: this.processingOrders.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        completedOrders: this.completedOrders.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        failedOrders: this.failedOrders.get()?.values.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        providerMetrics: this.providerMetrics.get()?.values || [],
        webhookMetrics: this.webhookProcessed.get()?.values || [],
        errorMetrics: this.errors.get()?.values || [],
        sellerRegistrations: this.sellerRegistrations.get()?.values || [],
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          loadavg: os.loadavg(),
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to collect Prometheus metrics', { error: errorMessage });
      throw new Error(`Failed to collect metrics: ${errorMessage}`);
    }
  }
}

export const prometheusMetrics = new PrometheusMetrics();