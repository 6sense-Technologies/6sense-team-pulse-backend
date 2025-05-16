// import { Injectable, Logger } from '@nestjs/common';
// import { ActivityLogEntryDto, CreateActivitiesDto } from './dto/create-activities.dto';
// import { Activity } from './entities/activity.schema';
// import { Model, Types } from 'mongoose';
// import { InjectModel } from '@nestjs/mongoose';
// import * as moment from 'moment';
// import { Application } from './entities/application.schema';
// import { InjectQueue } from '@nestjs/bullmq';
// import { Queue } from 'bullmq';
// import { ActivitySession } from './tracker.interface';
// import { OrganizationService } from '../organization/organization.service';
// import { ApplicationService } from './application.service';

// @Injectable()
// export class TrackerService {
//   private readonly logger = new Logger(TrackerService.name);
//   constructor(
//     @InjectModel(Activity.name)
//     private readonly activityModel: Model<Activity>,

//     // @InjectModel(Application.name)
//     // private readonly appModel: Model<Application>,

//     @InjectQueue('activity-log') 
//     private readonly activityLogQueue: Queue,

//     private readonly applicationService: ApplicationService,
//     private readonly organizationService: OrganizationService,
//   ) {}


//   // async findOrCreateApp(name: string) {
//   //   return this.appModel.findOneAndUpdate(
//   //     { name },
//   //     { $setOnInsert: { name } },
//   //     { upsert: true, new: true }
//   //   );
//   // }

//   async addActivityLogsToQueue(
//     userId: string,
//     organizationId: string,
//     activityLogs: ActivityLogEntryDto[],
//   ): Promise<{ queued: number }> {

//     if (!userId || !organizationId || !activityLogs?.length) {
//       this.logger.warn(`Invalid or empty job data: userId=${userId}, organizationId=${organizationId}, logs.length=${activityLogs?.length}`);
//       return { queued: 0 };
//     }
//     const validityOfOrgaizationUser = await this.organizationService.verifyUserofOrg(userId, organizationId);
//     if (!validityOfOrgaizationUser) {
//       this.logger.warn(`Invalid userId or organizationId: userId=${userId}, organizationId=${organizationId}`);
//       return { queued: 0 };
//     }

//     await this.activityLogQueue.add(
//       'process-activity', // 👈 Job name
//       {
//         user_id: userId,
//         organization_id: organizationId,
//         logs: activityLogs, // ✅ now send all logs in one job
//       },
//       {
//         jobId: `${userId}-${Date.now()}`, // Optional: deduplication or debugging
//         // removeOnComplete: true, // Optional: remove job after completion
//       }
//     );
  
//     return { queued: activityLogs.length };
//   }
  


//   // async finalizeSession(session: any, endTime: Date) {
//   //   const application = await this.findOrCreateApp(session.applicationName);

//   //   const activity = new this.activityModel({
//   //     name: session.name,
//   //     startTime: new Date(session.startTime),
//   //     endTime,
//   //     user: session.user,
//   //     organization: session.organization,
//   //     application: application._id,
//   //     pid: session.pid,
//   //     browserUrl: session.browserUrl,
//   //     faviconUrl: session.faviconUrl,
//   //   });

//   //   await activity.save();
//   // }


//   async createActivitiesFromSession(
//     activitySessions: ActivitySession[],
//     userId: string,
//     organizationId: string
//   ) {
//     try {
//       const enrichedSessions: any[] = [];
  
//       for (const session of activitySessions) {
//         const app = await this.applicationService.findOrCreate(session.appName, session.faviconUrl);
  
//         const name = session.windowTitle?.trim() || session.appName;
  
//         enrichedSessions.push({
//           name,
//           startTime: session.startTime,
//           endTime: session.endTime,
//           organization: new Types.ObjectId(organizationId),
//           user: new Types.ObjectId(userId),
//           application: app._id,
//           pid: session.pid,
//           browserUrl: session.browserUrl || null,
//           faviconUrl: session.faviconUrl || null,
//         });
//       }
  
//       const created = await this.activityModel.insertMany(enrichedSessions);
//       return created;
  
//     } catch (error) {
//       this.logger.error('Failed to create activities', error.message);
//       throw error;
//     }
//   }
  

//   // async findAllActivities(
//   //   organizationUserId: string,
//   //   userId: string,
//   //   date: string,
//   //   timezoneOffset: string = '+00:00' // default fallback
//   // ) {
//   //   try {
//   //     const query: any = {
//   //       organizationUserRole: organizationUserId,
//   //     };
  
//   //     // Validate timezoneOffset format (e.g. +06:00 or -05:30)
//   //     if (!/^[-+]\d{2}:\d{2}$/.test(timezoneOffset)) {
//   //       timezoneOffset = '+00:00'; // fallback to UTC
//   //     }
  
//   //     this.logger.log('Date:', date);
//   //     this.logger.log('Timezone Offset:', timezoneOffset);
  
//   //     // Use today's date in the user's timezone if not provided
//   //     if (!date) {
//   //       const now = moment().utcOffset(timezoneOffset);
//   //       date = now.format('YYYY-MM-DD');
//   //     }
  
//   //     const isoStart = `${date}T00:00:00${timezoneOffset}`;
//   //     const isoEnd = `${date}T23:59:59.999${timezoneOffset}`;
  
//   //     this.logger.log('ISO Start:', isoStart);
//   //     this.logger.log('ISO End:', isoEnd);
  
//   //     const startOfDayUTC = moment.parseZone(isoStart).utc().toISOString();
//   //     const endOfDayUTC = moment.parseZone(isoEnd).utc().toISOString();
  
//   //     this.logger.log('Start of Day UTC:', startOfDayUTC);
//   //     this.logger.log('End of Day UTC:', endOfDayUTC);
  
//   //     query.startTime = {
//   //       $gte: startOfDayUTC,
//   //       $lte: endOfDayUTC,
//   //     };
  
//   //     const activities = await this.activityModel.find(query);
//   //     return activities;
//   //   } catch (error) {
//   //     this.logger.error('Failed to find activities', error.message);
//   //     throw error;
//   //   }
//   // }



//   // create(createTrackerDto: CreateTrackerDto) {
//   //   return 'This action adds a new tracker';
//   // }

//   // findAll() {
//   //   return `This action returns all tracker`;
//   // }

//   // findOne(id: number) {
//   //   return `This action returns a #${id} tracker`;
//   // }

//   // update(id: number, updateTrackerDto: UpdateTrackerDto) {
//   //   return `This action updates a #${id} tracker`;
//   // }

//   // remove(id: number) {
//   //   return `This action removes a #${id} tracker`;
//   // }
// }
