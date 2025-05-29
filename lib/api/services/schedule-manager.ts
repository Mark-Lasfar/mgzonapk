import { RedisClient } from './redis';
import { logger } from './logging';
import { UnifiedFulfillmentService } from './unified-fulfillment';
import { SyncProgressTracker } from './sync-progress';
import { NotificationService } from './notification';
import { ObservabilityService } from './observability';
import { AdvancedInventorySyncService } from './inventory-sync';
import { SyncSchedule, ScheduleExecution, ScheduleFrequency } from '../types/scheduler';
import { connectToDatabase } from '@/lib/db';
import ScheduleModel from '@/lib/db/models/schedule.model';
import ExecutionModel from '@/lib/db/models/execution.model';
import parseExpression from 'cron-parser';
import { Duration } from 'luxon';
import crypto from 'crypto';
import { auth } from '@/auth';

export class ScheduleManager {
  private fulfillmentService: UnifiedFulfillmentService;
  private progressTracker: SyncProgressTracker;
  private notificationService: NotificationService;
  private inventorySyncService: AdvancedInventorySyncService;
  private observabilityService: ObservabilityService;
  private readonly DEFAULT_TIMEZONE = 'UTC';
  private readonly RETRY_MULTIPLIER = 2;
  private readonly MAX_RETRIES = 3;

  constructor(
    fulfillmentService: UnifiedFulfillmentService,
    progressTracker: SyncProgressTracker,
    notificationService: NotificationService
  ) {
    this.fulfillmentService = fulfillmentService;
    this.progressTracker = progressTracker;
    this.notificationService = notificationService;
    this.inventorySyncService = new AdvancedInventorySyncService();
    this.observabilityService = ObservabilityService.getInstance();

    logger.info('ScheduleManager initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  private async getCurrentUser(): Promise<string> {
    const session = await auth();
    return session?.user?.id || 'system';
  }

  async createSchedule(
    schedule: Omit<SyncSchedule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SyncSchedule> {
    try {
      const currentUser = await this.getCurrentUser();
      await connectToDatabase();

      const newSchedule = await ScheduleModel.create({
        ...schedule,
        id: crypto.randomBytes(16).toString('hex'),
        nextRun: this.calculateNextRun(
          schedule.frequency,
          schedule.timezone || this.DEFAULT_TIMEZONE
        ),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser,
        updatedBy: currentUser,
      });

      await this.scheduleNextRun(newSchedule);

      await this.observabilityService.recordMetric({
        name: 'schedule.created',
        value: 1,
        timestamp: new Date(),
        tags: { provider: newSchedule.provider },
      });

      logger.info('Created new sync schedule', {
        scheduleId: newSchedule.id,
        provider: newSchedule.provider,
        nextRun: newSchedule.nextRun,
        createdBy: currentUser,
        timestamp: new Date().toISOString(),
      });

      return newSchedule;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { schedule },
        timestamp: new Date(),
      });
      logger.error('Failed to create schedule', {
        error: errorMessage,
        schedule,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  private calculateNextRun(frequency: ScheduleFrequency, timezone: string): string {
    try {
      if (frequency.type === 'interval') {
        const duration = Duration.fromISO(frequency.value);
        return new Date(Date.now() + duration.toMillis()).toISOString();
      } else {
        const interval = parseExpression(frequency.value, {
          currentDate: new Date(),
          tz: timezone,
        });
        return interval.next().toDate().toISOString();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error calculating next run', {
        frequency,
        timezone,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async scheduleNextRun(schedule: SyncSchedule): Promise<void> {
    if (!schedule.enabled) {
      logger.info('Schedule is disabled, skipping next run', {
        scheduleId: schedule.id,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const currentUser = await this.getCurrentUser();
      const now = new Date().getTime();
      const nextRun = new Date(schedule.nextRun).getTime();
      const delay = Math.max(0, nextRun - now);

      await RedisClient.set(
        `schedule:${schedule.id}`,
        {
          ...schedule,
          lastChecked: new Date(now).toISOString(),
          updatedBy: currentUser,
        },
        { ex: Math.ceil(delay / 1000) + 60 } // Add 1 minute buffer
      );

      logger.info('Scheduled next run', {
        scheduleId: schedule.id,
        nextRun: schedule.nextRun,
        delay: `${Math.ceil(delay / 1000)}s`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId: schedule.id },
        timestamp: new Date(),
      });
      logger.error('Failed to schedule next run', {
        scheduleId: schedule.id,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async processScheduledSync(scheduleId: string): Promise<void> {
    const schedule = await ScheduleModel.findById(scheduleId);
    if (!schedule || !schedule.enabled) {
      logger.info('Schedule not found or disabled', {
        scheduleId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const currentUser = await this.getCurrentUser();
      const execution: ScheduleExecution = {
        id: crypto.randomBytes(16).toString('hex'),
        scheduleId: schedule.id,
        syncId: crypto.randomBytes(16).toString('hex'),
        provider: schedule.provider,
        status: 'pending',
        startTime: new Date().toISOString(),
        retryCount: 0,
      };

      await ExecutionModel.create(execution);

      const syncResult = await this.inventorySyncService.syncInventory(schedule.provider);

      const endTime = new Date().toISOString();
      await ExecutionModel.findByIdAndUpdate(execution.id, {
        status: syncResult.success ? 'completed' : 'failed',
        endTime,
        duration: new Date(endTime).getTime() - new Date(execution.startTime).getTime(),
        result: syncResult,
        updatedBy: currentUser,
      });

      if (schedule.notifications) {
        if (
          (syncResult.success && schedule.settings.notifyOnCompletion) ||
          (!syncResult.success && schedule.settings.notifyOnFailure)
        ) {
          await this.sendNotifications(schedule, execution, syncResult);
        }
      }

      const nextRun = this.calculateNextRun(
        schedule.frequency,
        schedule.timezone || this.DEFAULT_TIMEZONE
      );

      await ScheduleModel.findByIdAndUpdate(schedule.id, {
        lastRun: endTime,
        nextRun,
        updatedAt: endTime,
        updatedBy: currentUser,
      });

      await this.scheduleNextRun({
        ...schedule.toObject(),
        nextRun,
      });

      await this.observabilityService.recordMetric({
        name: 'schedule.execution',
        value: 1,
        timestamp: new Date(),
        tags: { provider: schedule.provider, status: syncResult.success ? 'success' : 'failed' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId, provider: schedule.provider },
        timestamp: new Date(),
      });
      logger.error('Scheduled sync failed', {
        scheduleId,
        provider: schedule.provider,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (schedule.settings.retryOnFailure) {
        await this.handleRetry(schedule);
      }
    }
  }

  private async handleRetry(schedule: SyncSchedule): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      const lastExecution = await ExecutionModel.findOne({
        scheduleId: schedule.id,
        status: 'failed',
      }).sort({ startTime: -1 });

      if (
        lastExecution &&
        lastExecution.retryCount < (schedule.settings.maxRetries || this.MAX_RETRIES)
      ) {
        const nextRetry = new Date(
          Date.now() + Math.pow(this.RETRY_MULTIPLIER, lastExecution.retryCount) * 60000
        ).toISOString();

        await ExecutionModel.findByIdAndUpdate(lastExecution.id, {
          retryCount: lastExecution.retryCount + 1,
          nextRetry,
          updatedBy: currentUser,
        });

        await RedisClient.set(
          `retry:${lastExecution.id}`,
          schedule.id,
          { ex: 60 * Math.pow(this.RETRY_MULTIPLIER, lastExecution.retryCount) }
        );

        logger.info('Scheduled retry', {
          executionId: lastExecution.id,
          scheduleId: schedule.id,
          retryCount: lastExecution.retryCount + 1,
          nextRetry,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId: schedule.id },
        timestamp: new Date(),
      });
      logger.error('Failed to handle retry', {
        scheduleId: schedule.id,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async sendNotifications(
    schedule: SyncSchedule,
    execution: ScheduleExecution,
    result: any
  ): Promise<void> {
    const notifications = schedule.notifications;
    const notificationData = {
      type: 'sync_execution',
      schedule,
      execution,
      result,
      timestamp: new Date().toISOString(),
    };

    try {
      if (notifications.email) {
        await this.notificationService.sendEmail(
          notifications.email,
          'Sync Schedule Execution Update',
          notificationData
        );
      }

      if (notifications.slack) {
        await this.notificationService.sendSlackMessage(
          typeof notifications.slack === 'string'
            ? { webhook: notifications.slack, channel: '' }
            : notifications.slack,
          notificationData
        );
      }

      if (notifications.webhook) {
        await this.notificationService.sendWebhook(
          typeof notifications.webhook === 'string'
            ? { url: notifications.webhook }
            : notifications.webhook,
          notificationData
        );
      }

      logger.info('Notifications sent successfully', {
        scheduleId: schedule.id,
        executionId: execution.id,
        channels: Object.keys(notifications),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId: schedule.id, executionId: execution.id },
        timestamp: new Date(),
      });
      logger.error('Failed to send notifications', {
        scheduleId: schedule.id,
        executionId: execution.id,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async updateScheduleStatus(scheduleId: string, status: 'enabled' | 'disabled'): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      const schedule = await ScheduleModel.findById(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule with ID ${scheduleId} not found.`);
      }

      schedule.enabled = status === 'enabled';
      schedule.updatedAt = new Date();
      schedule.updatedBy = currentUser;

      await schedule.save();

      await this.observabilityService.recordMetric({
        name: 'schedule.status_updated',
        value: 1,
        timestamp: new Date(),
        tags: { status },
      });

      logger.info('Schedule status updated', {
        scheduleId,
        status,
        updatedBy: currentUser,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId },
        timestamp: new Date(),
      });
      logger.error('Failed to update schedule status', {
        scheduleId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser();
      const schedule = await ScheduleModel.findById(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule with ID ${scheduleId} not found.`);
      }

      await schedule.deleteOne();

      await this.observabilityService.recordMetric({
        name: 'schedule.deleted',
        value: 1,
        timestamp: new Date(),
      });

      logger.info('Schedule deleted', {
        scheduleId,
        deletedBy: currentUser,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { scheduleId },
        timestamp: new Date(),
      });
      logger.error('Failed to delete schedule', {
        scheduleId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async listSchedules(): Promise<SyncSchedule[]> {
    try {
      const schedules = await ScheduleModel.find();
      return schedules;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: {},
        timestamp: new Date(),
      });
      logger.error('Failed to list schedules', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async getExecutionStatus(executionId: string): Promise<ScheduleExecution | null> {
    try {
      const execution = await ExecutionModel.findById(executionId);
      return execution || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { executionId },
        timestamp: new Date(),
      });
      logger.error('Failed to fetch execution status', {
        executionId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}