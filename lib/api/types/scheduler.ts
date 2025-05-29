import { FulfillmentProvider } from '../types';

export interface ScheduleFrequency {
  type: 'interval' | 'cron';
  value: string;
  hours?: number[];
  daysOfWeek?: number[];
  daysOfMonth?: number[];
}

export interface SyncSchedule {
  id: string;
  provider: FulfillmentProvider;
  enabled: boolean;
  frequency: ScheduleFrequency;
  timezone: string;
  filters?: {
    warehouses?: string[];
    productTypes?: string[];
    categories?: string[];
  };
  settings: {
    retryOnFailure: boolean;
    maxRetries: number;
    notifyOnCompletion: boolean;
    notifyOnFailure: boolean;
    skipWeekends?: boolean;
    skipHolidays?: boolean;
  };
  notifications?: {
    email?: string[];
    slack?: { webhook: string; channel: string } | string;
    webhook?: { url: string; headers?: Record<string, string> } | string;
  };
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'error';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  syncId: string;
  provider: FulfillmentProvider;
  status: 'pending' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  retryCount: number;
  nextRetry?: string;
  result?: any;
  updatedBy?: string;
}