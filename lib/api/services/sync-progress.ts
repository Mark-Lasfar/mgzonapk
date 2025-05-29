import { RedisClient } from './redis';
import { logger } from './logging';
import { ObservabilityService } from './observability';
import { WebhookDispatcher } from '../webhook-dispatcher';
import { SyncProgress, SyncStatus, SyncError, SyncWarning } from '../types/sync-progress';
import { pusher } from './pusher';
import { auth } from '@/auth';

export class SyncProgressTracker {
  private readonly SYNC_KEY_PREFIX = 'sync:progress:';
  private readonly SYNC_EXPIRY = 24 * 60 * 60; // 24 hours
  private observabilityService: ObservabilityService;

  constructor() {
    this.observabilityService = ObservabilityService.getInstance();
    logger.info('SyncProgressTracker initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  private async getCurrentUser(): Promise<string> {
    const session = await auth();
    return session?.user?.id || 'system';
  }

  async initializeSync(params: {
    syncId: string;
    provider: string;
    requestId: string;
    totalItems: number;
    metadata?: Record<string, any>;
  }): Promise<SyncProgress> {
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    const progress: SyncProgress = {
      syncId: params.syncId,
      provider: params.provider,
      requestId: params.requestId,
      status: 'queued',
      progress: {
        total: params.totalItems,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      timestamps: {
        started: timestamp,
        lastUpdated: timestamp,
      },
      errors: [],
      warnings: [],
      metadata: {
        ...params.metadata,
        initiatedBy: currentUser,
      },
      createdBy: currentUser,
      updatedBy: currentUser,
    };

    await this.saveProgress(progress);
    await this.notifyProgress(progress);

    await this.observabilityService.recordMetric({
      name: 'sync.initialized',
      value: 1,
      timestamp: new Date(),
      tags: { provider: params.provider },
    });

    logger.info('Sync initialized', {
      syncId: params.syncId,
      provider: params.provider,
      timestamp,
    });

    return progress;
  }

  async updateProgress(
    syncId: string,
    updates: {
      processed?: number;
      succeeded?: number;
      failed?: number;
      status?: SyncStatus;
      error?: SyncError;
      warning?: SyncWarning;
      metadata?: Record<string, any>;
    }
  ): Promise<SyncProgress> {
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    const progress = await this.getProgress(syncId);
    if (!progress) {
      throw new Error(`Sync ${syncId} not found`);
    }

    // Update progress counts
    if (updates.processed !== undefined) {
      progress.progress.processed = updates.processed;
      progress.progress.percentage = Math.round(
        (progress.progress.processed / progress.progress.total) * 100
      );
    }
    if (updates.succeeded !== undefined) {
      progress.progress.succeeded = updates.succeeded;
    }
    if (updates.failed !== undefined) {
      progress.progress.failed = updates.failed;
    }

    // Update status if provided
    if (updates.status) {
      progress.status = updates.status;
      if (updates.status === 'completed' || updates.status === 'failed') {
        progress.timestamps.completed = timestamp;
      }
    }

    // Add error if provided
    if (updates.error) {
      progress.errors.push({
        ...updates.error,
        timestamp,
        reportedBy: currentUser,
      });
    }

    // Add warning if provided
    if (updates.warning) {
      progress.warnings.push({
        ...updates.warning,
        timestamp,
        reportedBy: currentUser,
      });
    }

    // Update metadata if provided
    if (updates.metadata) {
      progress.metadata = {
        ...progress.metadata,
        ...updates.metadata,
        lastUpdatedBy: currentUser,
      };
    }

    progress.timestamps.lastUpdated = timestamp;
    progress.updatedBy = currentUser;

    await this.saveProgress(progress);
    await this.notifyProgress(progress);

    await this.observabilityService.recordMetric({
      name: 'sync.progress_updated',
      value: 1,
      timestamp: new Date(),
      tags: { syncId, status: progress.status },
    });

    return progress;
  }

  private async saveProgress(progress: SyncProgress): Promise<void> {
    const key = this.SYNC_KEY_PREFIX + progress.syncId;
    await RedisClient.set(key, progress, { ex: this.SYNC_EXPIRY });
  }

  private async notifyProgress(progress: SyncProgress): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      const timestamp = new Date().toISOString();

      // Send webhook notification
      await WebhookDispatcher.dispatch('system', 'inventory.sync.progress', {
        ...progress,
        notifiedAt: timestamp,
        notifiedBy: currentUser,
      });

      // Send real-time update via Pusher
      await pusher.trigger(`sync-${progress.syncId}`, 'progress-update', {
        ...progress,
        updatedAt: timestamp,
        updatedBy: currentUser,
      });

      logger.info('Sync progress updated', {
        syncId: progress.syncId,
        provider: progress.provider,
        status: progress.status,
        progress: progress.progress,
        timestamp,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { syncId: progress.syncId },
        timestamp: new Date(),
      });
      logger.error('Failed to notify progress', {
        error: errorMessage,
        syncId: progress.syncId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getProgress(syncId: string): Promise<SyncProgress | null> {
    const key = this.SYNC_KEY_PREFIX + syncId;
    return await RedisClient.get<SyncProgress>(key);
  }

  async listActiveSyncs(): Promise<SyncProgress[]> {
    try {
      const keys = await RedisClient.getInstance().keys(this.SYNC_KEY_PREFIX + '*');
      const syncs = await Promise.all(
        keys.map(async (key) => await RedisClient.get<SyncProgress>(key))
      );

      return syncs
        .filter((sync): sync is SyncProgress => sync !== null)
        .filter(
          (sync) =>
            sync.status === 'queued' || sync.status === 'running' || sync.status === 'paused'
        );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: {},
        timestamp: new Date(),
      });
      logger.error('Failed to list active syncs', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      return [];
    }
  }

  async cancelSync(syncId: string): Promise<SyncProgress> {
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    const progress = await this.getProgress(syncId);
    if (!progress) {
      throw new Error(`Sync ${syncId} not found`);
    }

    const updatedProgress = await this.updateProgress(syncId, {
      status: 'cancelled',
      metadata: {
        ...progress.metadata,
        cancelledAt: timestamp,
        cancelledBy: currentUser,
      },
    });

    await this.observabilityService.recordMetric({
      name: 'sync.cancelled',
      value: 1,
      timestamp: new Date(),
      tags: { syncId },
    });

    return updatedProgress;
  }
}