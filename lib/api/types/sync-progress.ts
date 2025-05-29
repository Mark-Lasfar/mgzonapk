export type SyncStatus = 
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SyncError {
  code: string;
  message: string;
  details?: any;
  source?: string;
  timestamp: string;
  reportedBy: string;
}

export interface SyncWarning {
  code: string;
  message: string;
  details?: any;
  source?: string;
  timestamp: string;
  reportedBy: string;
}

export interface SyncProgress {
  syncId: string;
  provider: string;
  requestId: string;
  status: SyncStatus;
  progress: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    percentage: number;
    currentBatch?: number;
    totalBatches?: number;
  };
  timestamps: {
    started: string;
    lastUpdated: string;
    completed?: string;
    cancelled?: string;
    paused?: string;
    resumed?: string;
  };
  errors: SyncError[];
  warnings: SyncWarning[];
  metadata: Record<string, any>;
  createdBy: string;
  updatedBy: string;
}

export interface SyncUpdate {
  processed?: number;
  succeeded?: number;
  failed?: number;
  status?: SyncStatus;
  error?: Omit<SyncError, 'timestamp' | 'reportedBy'>;
  warning?: Omit<SyncWarning, 'timestamp' | 'reportedBy'>;
  metadata?: Record<string, any>;
  timestamp: string;
  updatedBy: string;
}

export interface SyncResult {
  syncId: string;
  provider: string;
  status: SyncStatus;
  summary: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
  errors: SyncError[];
  warnings: SyncWarning[];
  metadata: Record<string, any>;
  startedAt: string;
  completedAt: string;
  initiatedBy: string;
  completedBy: string;
}