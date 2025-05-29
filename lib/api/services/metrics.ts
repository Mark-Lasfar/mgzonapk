import os from 'os';
import { adminFirestore } from '@/lib/firebase/admin';
import { IMetric, IMetricAggregation, MetricType } from '@/types/metrics';
// import { IMetric, IMetricAggregation, MetricType } from '@/types/metrics';

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
    return snapshot.docs.map(doc => {
      const data = doc.data();
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        data.timestamp = data.timestamp.toDate();
      }
      return {
        id: doc.id,
        ...data
      } as IMetric;
    });
  }

  async saveMetric(metric: IMetric) {
    const { id, ...data } = metric;
    return await this.collection.add({
      ...data,
      timestamp: new Date()
    });
  }

  async aggregateMetrics(options: {
    type: MetricType;
    interval: 'hour' | 'day' | 'week' | 'month';
    from?: Date;
    to?: Date;
  }): Promise<IMetricAggregation[]> {
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
          const week = Math.floor(date.getDate() / 7);
          key = `${date.getFullYear()}-W${week}`;
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
          max: -Infinity
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
      min: group.min,
      max: group.max,
      avg: group.sum / group.count
    }));
  }

  async getRealtimeMetrics(type: MetricType) {
    const snapshot = await this.collection
      .where('type', '==', type)
      .where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000))
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    return snapshot.docs[0]?.data() as IMetric;
  }
}

export const metricsService = new MetricsService();

// Prometheus-style metrics collector
export class PrometheusMetrics {
  private requestCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private latencySamples: number[] = [];

  recordRequest(success: boolean, latency: number) {
    this.requestCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    this.latencySamples.push(latency);
  }

  async collect() {
    const averageLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
        : 0;

    const result = {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.failureCount,
      averageLatency,
      pendingOrders: Math.floor(Math.random() * 10),
      processingOrders: Math.floor(Math.random() * 10),
      completedOrders: Math.floor(Math.random() * 10),
      failedOrders: Math.floor(Math.random() * 5),
      providerMetrics: [
        {
          provider: 'ShipBob',
          status: 'online',
          latency: Math.random() * 100
        },
        {
          provider: 'PayPal',
          status: 'online',
          latency: Math.random() * 100
        }
      ],
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        loadavg: os.loadavg(),
        uptime: process.uptime()
      }
    };

    return result;
  }
}

export const prometheusMetrics = new PrometheusMetrics();
