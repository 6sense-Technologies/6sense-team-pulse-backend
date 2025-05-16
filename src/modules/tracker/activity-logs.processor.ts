// import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
// import { Worker, Job } from 'bullmq';
// import { ConfigService } from '@nestjs/config';
// import Redis from 'ioredis';
// // import { TrackerService } from './tracker.service';
// import { ActivityLog, ActivitySession } from './tracker.interface';
// import { ActivityService } from './activity.service';
// // import dayjs from 'dayjs';
// // import { ActivityService } from './activity.service'; // Adjust import path

// @Injectable()
// export class ActivityLogsProcessor implements OnModuleInit {
//   private worker: Worker;
//   private redis: Redis;

//   constructor(
//     private configService: ConfigService,
//     private activityService: ActivityService,
//   ) {
//     this.redis = new Redis({
//       host: this.configService.get('REDIS_HOST'),
//       port: +this.configService.get('REDIS_PORT'),
//     });
//   }

//   onModuleInit() {

//     try {
//       const result = this.redis.ping()
//       .then((res) => console.log('✅ Redis connection successful:', res)) // Should print "PONG")
//       .catch((err) => err);
//     } catch (err) {
//       console.error('❌ Redis connection failed:', err);
//     }
    
//     this.worker = new Worker(
//       'activity-log',
//       async (job: Job) => {
//         await this.handleActivityLog(job);
//       },
//       {
//         connection: {
//           host: this.configService.get('REDIS_HOST'),
//           port: +this.configService.get('REDIS_PORT'),
//         },
//       }
//     );
//   }

//   // async handleActivityLog(job: Job<any>) {
//   //   const MIN_SESSION_DURATION_MS = 1; // You can change this value as needed
  
//   //   const { organization_id, user_id, logs }: { organization_id: string, user_id: string, logs: ActivityLog[] } = job.data;
  
//   //   if (!organization_id || !user_id || !logs?.length) {
//   //     console.warn(`Invalid or empty job data in job ${job.id}`);
//   //     return;
//   //   }
  
//   //   console.log(`Processing activity log of job ${job.id} for ${organization_id}:${user_id}`);
  
//   //   // Sort logs by timestamp
//   //   const sortedLogs = logs.sort(
//   //     (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
//   //   );
  
//   //   const redisKey = `activity:last:${organization_id}:${user_id}`;
//   //   const lastLogStr = await this.redis.get(redisKey);
//   //   console.log(`Last log for ${organization_id}:${user_id} is ${lastLogStr}`);
//   //   let lastContext: ActivityLog | null = lastLogStr ? JSON.parse(lastLogStr) : null;
  
//   //   const allSessions: ActivitySession[] = [];
//   //   let currentSessionStart: ActivityLog | null = null;
  
//   //   for (let i = 0; i < sortedLogs.length; i++) {
//   //     const log = sortedLogs[i];
//   //     const prevLog = i > 0 ? sortedLogs[i - 1] : lastContext;
  
//   //     console.log('Comparing logs:', log, prevLog);
  
//   //     const isSameContext =
//   //       prevLog &&
//   //       log.app_name === prevLog.app_name &&
//   //       log.browser_url === prevLog.browser_url &&
//   //       log.window_title === prevLog.window_title;
  
//   //     if (!isSameContext) {
//   //       if (currentSessionStart && prevLog) {
//   //         const startTime = new Date(currentSessionStart.timestamp).getTime();
//   //         const endTime = new Date(prevLog.timestamp).getTime();
//   //         const duration = endTime - startTime;
  
//   //         if (duration > MIN_SESSION_DURATION_MS) {
//   //           allSessions.push({
//   //             organization_id,
//   //             user_id,
//   //             app_name: currentSessionStart.app_name,
//   //             browser_url: currentSessionStart.browser_url,
//   //             window_title: currentSessionStart.window_title,
//   //             start_time: currentSessionStart.timestamp,
//   //             end_time: prevLog.timestamp,
//   //           });
//   //         } else if (duration > 0) {
//   //           console.log(`Ignored short session of ${duration}ms`);
//   //         } else {
//   //           console.warn(`Invalid session with non-positive duration: ${duration}ms (start: ${currentSessionStart.timestamp}, end: ${prevLog.timestamp})`);
//   //         }
//   //       }
//   //       currentSessionStart = log;
//   //     }
//   //   }
  
//   //   const lastLog = sortedLogs[sortedLogs.length - 1];
//   //   if (currentSessionStart && lastLog) {
//   //     await this.redis.set(redisKey, JSON.stringify(lastLog), 'EX', 600); // 10 min TTL
//   //   }
  
//   //   if (allSessions.length > 0) {
//   //     // await this.activityService.saveSessions(allSessions);
//   //     console.log(`Saved ${allSessions.length} activity sessions for ${user_id}.`);
//   //     console.log(allSessions);
//   //   }
//   // }

//   async handleActivityLog(job: Job<any>) {
//     const MIN_SESSION_DURATION_MS = -1; // You can change this value as needed
  
//     const { organization_id, user_id, logs }: { organization_id: string, user_id: string, logs: ActivityLog[] } = job.data;
  
//     if (!organization_id || !user_id || !logs?.length) {
//       console.warn(`Invalid or empty job data in job ${job.id}`);
//       return;
//     }
  
//     console.log(`Processing activity log of job ${job.id} for ${organization_id}:${user_id}`);
  
//     // Sort logs by timestamp
//     const sortedLogs = logs.sort(
//       (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
//     );
  
//     const redisKey = `bull:activity-log:last:${organization_id}:${user_id}`;
//     const lastLogStr = await this.redis.get(redisKey);
//     console.log(`Last log for ${organization_id}:${user_id} is ${lastLogStr}`);
//     let lastContext: ActivityLog | null = lastLogStr ? JSON.parse(lastLogStr) : null;
  
//     const allSessions: ActivitySession[] = [];
//     let currentSessionStart: ActivityLog | null = null;
  
//     // Handle cross-batch session
//     if (lastContext && sortedLogs.length > 0) {
//       const firstLog = sortedLogs[0];
//       const isSameContext =
//         lastContext.app_name === firstLog.app_name &&
//         lastContext.browser_url === firstLog.browser_url &&
//         lastContext.window_title === firstLog.window_title &&
//         lastContext.pid === firstLog.pid;
  
//       if (!isSameContext) {
//         const startTime = new Date(lastContext.timestamp).getTime();
//         const endTime = new Date(firstLog.timestamp).getTime();
//         const duration = endTime - startTime;
  
//         if (duration > MIN_SESSION_DURATION_MS) {
//           allSessions.push({
//             organization: organization_id,
//             user: user_id,
//             appName: lastContext.app_name,
//             browserUrl: lastContext.browser_url,
//             windowTitle: lastContext.window_title,
//             pid: lastContext.pid,
//             faviconUrl: lastContext.favicon_url,
//             startTime: lastContext.timestamp,
//             endTime: firstLog.timestamp,
//           });
//         } else if (duration >= 0) {
//           console.log(`Ignored cross-batch short session of ${duration}ms`);
//         } else {
//           console.warn(`Invalid cross-batch session with non-positive duration: ${duration}ms (start: ${lastContext.timestamp}, end: ${firstLog.timestamp})`);
//         }
//       }
//     }
  
//     for (let i = 0; i < sortedLogs.length; i++) {
//       const log = sortedLogs[i];
//       const prevLog = i > 0 ? sortedLogs[i - 1] : lastContext;
  
//       console.log('Comparing logs:', log, prevLog);
  
//       const isSameContext =
//         prevLog &&
//         log.app_name === prevLog.app_name &&
//         log.browser_url === prevLog.browser_url &&
//         log.window_title === prevLog.window_title;
  
//       if (!isSameContext) {
//         if (currentSessionStart && prevLog) {
//           const startTime = new Date(currentSessionStart.timestamp).getTime();
//           const endTime = new Date(prevLog.timestamp).getTime();
//           const duration = endTime - startTime;
  
//           if (duration > MIN_SESSION_DURATION_MS) {
//             allSessions.push({
//               organization: organization_id,
//               user: user_id,
//               appName: currentSessionStart.app_name,
//               browserUrl: currentSessionStart.browser_url,
//               windowTitle: currentSessionStart.window_title,
//               pid: currentSessionStart.pid,
//               faviconUrl: currentSessionStart.favicon_url,
//               startTime: currentSessionStart.timestamp,
//               endTime: prevLog.timestamp,
//             });
//           } else if (duration > 0) {
//             console.log(`Ignored short session of ${duration}ms`);
//           } else {
//             console.warn(`Invalid session with non-positive duration: ${duration}ms (start: ${currentSessionStart.timestamp}, end: ${prevLog.timestamp})`);
//           }
//         }
//         currentSessionStart = log;
//       }
//     }
  
//     const lastLog = sortedLogs[sortedLogs.length - 1];
//     if (currentSessionStart && lastLog) {
//       await this.redis.set(redisKey, JSON.stringify(lastLog), 'EX', 600); // Set TTL to 10 minutes (600 seconds)
//       console.log(`Updated Redis key ${redisKey} with TTL of 10 minutes.`);
//     }
  
//     if (allSessions.length > 0) {
//       // await this.activityService.saveSessions(allSessions);
//       console.log(`Saved ${allSessions.length} activity sessions for ${user_id}.`);
//       console.log(allSessions);
//       this.activityService.createActivitiesFromSession(allSessions, user_id, organization_id);
//     }

//     // job.remove(); // Remove the job from the queue after processing
//   }
  
  
// }


// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { Worker, Job } from 'bullmq';
// import { ConfigService } from '@nestjs/config';
// import Redis from 'ioredis';
// import { ActivityLog, ActivitySession } from './tracker.interface';
// import { ActivityService } from './activity.service';

// @Injectable()
// export class ActivityLogsProcessor implements OnModuleInit {
//   private worker: Worker;
//   private redis: Redis;

//   constructor(
//     private configService: ConfigService,
//     private activityService: ActivityService,
//   ) {
//     this.redis = new Redis({
//       host: this.configService.get('REDIS_HOST'),
//       port: +this.configService.get('REDIS_PORT'),
//     });
//   }

//   onModuleInit() {
//     this.redis.ping()
//       .then((res) => console.log('✅ Redis connection successful:', res))
//       .catch((err) => console.error('❌ Redis connection failed:', err));

//     this.worker = new Worker(
//       'activity-log',
//       async (job: Job) => this.handleActivityLog(job),
//       {
//         connection: {
//           host: this.configService.get('REDIS_HOST'),
//           port: +this.configService.get('REDIS_PORT'),
//         },
//       }
//     );
//   }

//   async handleActivityLog(job: Job<any>) {
//     const MIN_SESSION_DURATION_MS = -1;
//     try {
//       const { organization_id, user_id, logs } = this.validateJobData(job);
//       const sortedLogs = this.sortLogs(logs);
//       const lastContext = await this.getLastContext(organization_id, user_id);

//       const crossBatchSessions = this.handleCrossBatchSession(
//         lastContext,
//         sortedLogs[0],
//         organization_id,
//         user_id,
//         MIN_SESSION_DURATION_MS,
//       );

//       const currentSessions = this.extractSessionsFromLogs(
//         sortedLogs,
//         lastContext,
//         organization_id,
//         user_id,
//         MIN_SESSION_DURATION_MS,
//       );

//       const allSessions = [...crossBatchSessions, ...currentSessions];

//       await this.updateLastLogInRedis(organization_id, user_id, sortedLogs.at(-1));
//       await this.persistSessions(allSessions, organization_id, user_id);

//     } catch (error) {
//       console.error(`❌ Error processing job ${job.id}:`, error);
//     }
//   }

//   private validateJobData(job: Job<any>) {
//     const { organization_id, user_id, logs } = job.data;
//     if (!organization_id || !user_id || !logs?.length) {
//       throw new Error(`Invalid or empty job data in job ${job.id}`);
//     }
//     return { organization_id, user_id, logs };
//   }

//   private sortLogs(logs: ActivityLog[]): ActivityLog[] {
//     return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
//   }

//   private async getLastContext(orgId: string, userId: string): Promise<ActivityLog | null> {
//     const redisKey = this.getRedisKeyForLastActivityLog(orgId, userId);
//     const lastLogStr = await this.redis.get(redisKey);
//     return lastLogStr ? JSON.parse(lastLogStr) : null;
//   }

//   private handleCrossBatchSession(
//     lastContext: ActivityLog | null,
//     firstLog: ActivityLog,
//     orgId: string,
//     userId: string,
//     minDuration: number
//   ): ActivitySession[] {
//     if (!lastContext) return [];

//     const isSameContext = lastContext.app_name === firstLog.app_name &&
//       lastContext.browser_url === firstLog.browser_url &&
//       lastContext.window_title === firstLog.window_title &&
//       lastContext.pid === firstLog.pid;

//     if (isSameContext) return [];

//     const startTime = new Date(lastContext.timestamp).getTime();
//     const endTime = new Date(firstLog.timestamp).getTime();
//     const duration = endTime - startTime;

//     if (duration > minDuration) {
//       return [{
//         organization: orgId,
//         user: userId,
//         appName: lastContext.app_name,
//         browserUrl: lastContext.browser_url,
//         windowTitle: lastContext.window_title,
//         pid: lastContext.pid,
//         faviconUrl: lastContext.favicon_url,
//         startTime: lastContext.timestamp,
//         endTime: firstLog.timestamp,
//       }];
//     } else {
//       console.warn(`⚠️ Ignored invalid cross-batch session: ${duration}ms`);
//       return [];
//     }
//   }

//   private extractSessionsFromLogs(
//     logs: ActivityLog[],
//     lastContext: ActivityLog | null,
//     orgId: string,
//     userId: string,
//     minDuration: number
//   ): ActivitySession[] {
//     const sessions: ActivitySession[] = [];
//     let currentSessionStart: ActivityLog | null = null;

//     for (let i = 0; i < logs.length; i++) {
//       const log = logs[i];
//       const prevLog = i > 0 ? logs[i - 1] : lastContext;

//       const isSameContext = prevLog &&
//         log.app_name === prevLog.app_name &&
//         log.browser_url === prevLog.browser_url &&
//         log.window_title === prevLog.window_title;

//       if (!isSameContext) {
//         if (currentSessionStart && prevLog) {
//           const start = new Date(currentSessionStart.timestamp).getTime();
//           const end = new Date(prevLog.timestamp).getTime();
//           const duration = end - start;

//           if (duration > minDuration) {
//             sessions.push({
//               organization: orgId,
//               user: userId,
//               appName: currentSessionStart.app_name,
//               browserUrl: currentSessionStart.browser_url,
//               windowTitle: currentSessionStart.window_title,
//               pid: currentSessionStart.pid,
//               faviconUrl: currentSessionStart.favicon_url,
//               startTime: currentSessionStart.timestamp,
//               endTime: prevLog.timestamp,
//             });
//           } else {
//             console.log(`⏱️ Ignored short session: ${duration}ms`);
//           }
//         }
//         currentSessionStart = log;
//       }
//     }

//     return sessions;
//   }

//   private async updateLastLogInRedis(orgId: string, userId: string, lastLog: ActivityLog | undefined) {
//     if (!lastLog) return;
//     const redisKey = this.getRedisKeyForLastActivityLog(orgId, userId);
//     await this.redis.set(redisKey, JSON.stringify(lastLog), 'EX', 600);
//     console.log(`🔁 Redis updated for ${redisKey}`);
//   }

//   private async persistSessions(
//     sessions: ActivitySession[],
//     orgId: string,
//     userId: string
//   ) {
//     if (!sessions.length) return;
//     await this.activityService.createActivitiesFromSession(sessions, userId, orgId);
//     console.log(`💾 Saved ${sessions.length} sessions for ${userId}`);
//   }

//   private getRedisKeyForLastActivityLog(orgId: string, userId: string): string {
//     return `bull:activity-log:last:${orgId}:${userId}`;
//   }
// }






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
    });
  }

  onModuleInit() {
    this.redis.ping()
      .then((res) => this.logger.log(`✅ Redis connection successful: ${res}`))
      .catch((err) => this.logger.error('❌ Redis connection failed', err));

    this.worker = new Worker(
      'activity-log',
      async (job: Job) => this.handleActivityLog(job),
      {
        connection: {
          host: this.configService.get('REDIS_HOST'),
          port: +this.configService.get('REDIS_PORT'),
        },
      }
    );
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
    minDuration: number
  ): ActivitySession[] {
    if (!lastContext) return [];

    const isSameContext = lastContext.app_name === firstLog.app_name &&
      lastContext.browser_url === firstLog.browser_url &&
      lastContext.window_title === firstLog.window_title &&
      lastContext.pid === firstLog.pid;

    if (isSameContext) return [];

    const startTime = new Date(lastContext.timestamp).getTime();
    const endTime = new Date(firstLog.timestamp).getTime();
    const duration = endTime - startTime;

    if (duration > minDuration) {
      return [{
        organization: orgId,
        user: userId,
        appName: lastContext.app_name,
        browserUrl: lastContext.browser_url,
        windowTitle: lastContext.window_title,
        pid: lastContext.pid,
        faviconUrl: lastContext.favicon_url,
        startTime: lastContext.timestamp,
        endTime: firstLog.timestamp,
      }];
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
    minDuration: number
  ): ActivitySession[] {
    const sessions: ActivitySession[] = [];
    let currentSessionStart: ActivityLog | null = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const prevLog = i > 0 ? logs[i - 1] : lastContext;

      this.logger.debug(`Comparing logs: ${JSON.stringify(log)} with ${JSON.stringify(prevLog)}`);

      const isSameContext = prevLog &&
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

  private async updateLastLogInRedis(orgId: string, userId: string, lastLog: ActivityLog | undefined) {
    if (!lastLog) return;
    const redisKey = this.getRedisKeyForLastActivityLog(orgId, userId);
    await this.redis.set(redisKey, JSON.stringify(lastLog), 'EX', 600);
    this.logger.debug(`🔁 Redis updated for ${redisKey}`);
  }

  private async persistSessions(
    sessions: ActivitySession[],
    orgId: string,
    userId: string
  ) {
    if (!sessions.length) return;
    // this.logger.log(`💾 Saving ${sessions.length} sessions for ${userId}`);
    await this.activityService.createActivitiesFromSession(sessions, userId, orgId);
  }

  private getRedisKeyForLastActivityLog(orgId: string, userId: string): string {
    return `bull:activity-log:last:${orgId}:${userId}`;
  }
}

