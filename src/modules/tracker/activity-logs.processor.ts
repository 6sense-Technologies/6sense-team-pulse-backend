import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ActivityLog, ActivitySession } from './tracker.interface';
import { ActivityService } from './activity.service';

@Injectable()
export class ActivityLogsProcessor implements OnModuleInit {
  private readonly logger = new Logger(ActivityLogsProcessor.name);
  private worker: Worker;
  private redis: Redis;

  constructor(
    private configService: ConfigService,
    private activityService: ActivityService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST'),
      port: +this.configService.get('REDIS_PORT'),
      username: this.configService.get('REDIS_USERNAME'),
      password: this.configService.get('REDIS_PASSWORD'),
    });
  }

  onModuleInit() {
    this.redis
      .ping()
      .then((res) => this.logger.log(`✅ Redis connection successful: ${res}`))
      .catch((err) => this.logger.error('❌ Redis connection failed', err));

    this.worker = new Worker('activity-log', async (job: Job) => this.handleActivityLog(job), {
      connection: {
        host: this.configService.get('REDIS_HOST'),
        port: +this.configService.get('REDIS_PORT'),
        username: this.configService.get('REDIS_USERNAME'),
        password: this.configService.get('REDIS_PASSWORD'),
      },
    });
  }

  async handleActivityLog(job: Job<any>) {
    const MIN_SESSION_DURATION_MS = -1;

    try {
      const { organization_id, user_id, logs } = this.validateJobData(job);
      this.logger.log(`Processing job ${job.id} for ${organization_id}:${user_id}`);

      const sortedLogs = this.sortLogs(logs);
      const lastContext = await this.getLastContext(organization_id, user_id);

      const crossBatchSessions = this.handleCrossBatchSession(
        lastContext,
        sortedLogs[0],
        organization_id,
        user_id,
        MIN_SESSION_DURATION_MS,
      );

      const currentSessions = this.extractSessionsFromLogs(
        sortedLogs,
        lastContext,
        organization_id,
        user_id,
        MIN_SESSION_DURATION_MS,
      );

      const allSessions = [...crossBatchSessions, ...currentSessions];

      await this.updateLastLogInRedis(organization_id, user_id, sortedLogs.at(-1));
      await this.persistSessions(allSessions, organization_id, user_id);
    } catch (error) {
      this.logger.error(`❌ Error processing job ${job.id}`, error.stack);
    }
  }

  private validateJobData(job: Job<any>) {
    const { organization_id, user_id, logs } = job.data;
    if (!organization_id || !user_id || !logs?.length) {
      this.logger.warn(`Invalid or empty job data in job ${job.id}`);
      throw new Error(`Invalid or empty job data in job ${job.id}`);
    }
    return { organization_id, user_id, logs };
  }

  private sortLogs(logs: ActivityLog[]): ActivityLog[] {
    return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private async getLastContext(orgId: string, userId: string): Promise<ActivityLog | null> {
    const redisKey = this.getRedisKeyForLastActivityLog(orgId, userId);
    const lastLogStr = await this.redis.get(redisKey);
    this.logger.debug(`Last log for ${orgId}:${userId} is ${lastLogStr}`);
    return lastLogStr ? JSON.parse(lastLogStr) : null;
  }

  private handleCrossBatchSession(
    lastContext: ActivityLog | null,
    firstLog: ActivityLog,
    orgId: string,
    userId: string,
    minDuration: number,
  ): ActivitySession[] {
    if (!lastContext) return [];

    const isSameContext =
      lastContext.app_name === firstLog.app_name &&
      lastContext.browser_url === firstLog.browser_url &&
      lastContext.window_title === firstLog.window_title &&
      lastContext.pid === firstLog.pid;

    if (isSameContext) return [];

    const startTime = new Date(lastContext.timestamp).getTime();
    const endTime = new Date(firstLog.timestamp).getTime();
    const duration = endTime - startTime;

    if (duration > minDuration) {
      return [
        {
          organization: orgId,
          user: userId,
          appName: lastContext.app_name,
          browserUrl: lastContext.browser_url,
          windowTitle: lastContext.window_title,
          pid: lastContext.pid,
          faviconUrl: lastContext.favicon_url,
          startTime: lastContext.timestamp,
          endTime: firstLog.timestamp,
        },
      ];
    } else {
      this.logger.warn(`⚠️ Ignored invalid cross-batch session: ${duration}ms`);
      return [];
    }
  }

  private extractSessionsFromLogs(
    logs: ActivityLog[],
    lastContext: ActivityLog | null,
    orgId: string,
    userId: string,
    minDuration: number,
  ): ActivitySession[] {
    const sessions: ActivitySession[] = [];
    let currentSessionStart: ActivityLog | null = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const prevLog = i > 0 ? logs[i - 1] : lastContext;

      this.logger.debug(`Comparing logs: ${JSON.stringify(log)} with ${JSON.stringify(prevLog)}`);

      const isSameContext =
        prevLog &&
        log.app_name === prevLog.app_name &&
        log.browser_url === prevLog.browser_url &&
        log.window_title === prevLog.window_title;

      if (!isSameContext) {
        if (currentSessionStart && prevLog) {
          const start = new Date(currentSessionStart.timestamp).getTime();
          const end = new Date(prevLog.timestamp).getTime();
          const duration = end - start;

          if (duration > minDuration) {
            sessions.push({
              organization: orgId,
              user: userId,
              appName: currentSessionStart.app_name,
              browserUrl: currentSessionStart.browser_url,
              windowTitle: currentSessionStart.window_title,
              pid: currentSessionStart.pid,
              faviconUrl: currentSessionStart.favicon_url,
              startTime: currentSessionStart.timestamp,
              endTime: prevLog.timestamp,
            });
          } else {
            this.logger.debug(`⏱️ Ignored short session: ${duration}ms`);
          }
        }
        currentSessionStart = log;
      }
    }

    return sessions;
  }

  private async updateLastLogInRedis(
    orgId: string,
    userId: string,
    lastLog: ActivityLog | undefined,
  ) {
    if (!lastLog) return;
    const redisKey = this.getRedisKeyForLastActivityLog(orgId, userId);
    await this.redis.set(redisKey, JSON.stringify(lastLog), 'EX', 600);
    this.logger.debug(`🔁 Redis updated for ${redisKey}`);
  }

  private async persistSessions(sessions: ActivitySession[], orgId: string, userId: string) {
    if (!sessions.length) return;
    // this.logger.log(`💾 Saving ${sessions.length} sessions for ${userId}`);
    await this.activityService.createActivitiesFromSession(sessions, userId, orgId);
  }

  private getRedisKeyForLastActivityLog(orgId: string, userId: string): string {
    return `bull:activity-log:last:${orgId}:${userId}`;
  }
}
