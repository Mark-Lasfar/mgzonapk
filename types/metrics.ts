export type MetricType = 
  | 'sales'
  | 'views'
  | 'ratings'
  | 'orders'
  | 'shipments'
  | 'webhooks'
  | 'seller_registrations'
  | 'fulfillment_errors'
  | 'api_requests'
  | 'withdrawals'
  | 'payment_success'
  | 'payment_failed'
  | 'SUPPORT';
  
  

export interface IMetric {
  id?: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  userId?: string;
  source?: string;
  provider?: string;
  metadata?: Record<string, any>;
}

export interface IMetricAggregation {
  type: MetricType;
  interval: 'hour' | 'day' | 'week' | 'month';
  timestamp: Date;
  value: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  metadata?: Record<string, any>;
}

export interface IProviderMetric {
  provider: string;
  status: 'online' | 'offline' | 'degraded';
  latency: number;
  operation: string;
  timestamp: Date;
}

export interface ISystemMetric {
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  loadavg: number[];
  uptime: number;
}

export interface IPaymentMethod {
  type: string;
  accountDetails: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    swiftCode?: string;
    email?: string; // For PayPal/Wise
    routingNumber?: string; // For US banks
    country?: string;
  };
  verified: boolean;
}