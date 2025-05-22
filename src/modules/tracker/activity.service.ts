import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ActivityLogEntryDto,
  CreateActivitiesDto,
} from './dto/create-activities.dto';
import { Activity } from './entities/activity.schema';
import mongoose, { isValidObjectId, Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import 'moment-timezone';
import { Application } from './entities/application.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActivitySession } from './tracker.interface';
import { OrganizationService } from '../organization/organization.service';
import { ApplicationService } from './application.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { calculateTimeSpent } from './time.utils';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<Activity>,

    @InjectQueue('activity-log')
    private readonly activityLogQueue: Queue,

    private readonly applicationService: ApplicationService,
    private readonly organizationService: OrganizationService,
  ) {}

  async addActivityLogsToQueue(
    userId: string,
    organizationId: string,
    activityLogs: ActivityLogEntryDto[],
  ): Promise<{ queued: number }> {
    if (!userId || !organizationId || !activityLogs?.length) {
      this.logger.warn(`Invalid or empty job data`, { userId, organizationId });
      return { queued: 0 }; // This is fine as a controlled no-op
    }

    try {
      const isValid = await this.organizationService.verifyUserofOrg(
        userId,
        organizationId,
      );
      if (!isValid) {
        throw new UnauthorizedException(
          `User ${userId} not in organization ${organizationId}`,
        );
      }

      await this.activityLogQueue.add(
        'process-activity',
        {
          user_id: userId,
          organization_id: organizationId,
          logs: activityLogs,
        },
        {
          jobId: `${userId}-${Date.now()}`,
          removeOnComplete: true,
        },
      );

      return { queued: activityLogs.length };
    } catch (error) {
      this.logger.error(`Failed to queue activity logs`, {
        userId,
        organizationId,
        error: error.message,
      });
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Could not queue activity logs');
    }
  }

  async createActivitiesFromSession(
    activitySessions: ActivitySession[],
    userId: string,
    organizationId: string,
  ) {
    try {
      const enrichedSessions: any[] = [];

      const latest = await this.activityModel
        .findOne({
          user: new Types.ObjectId(userId),
          organization: new Types.ObjectId(organizationId),
        })
        .sort({ endTime: -1 });

      for (const session of activitySessions) {
        if (latest && new Date(session.startTime) <= new Date(latest.endTime)) {
          continue;
        }
        const app = await this.applicationService.findOrCreate(
          session.appName,
          session.faviconUrl,
        );

        const name = session.windowTitle?.trim() || session.appName;

        enrichedSessions.push({
          name,
          startTime: session.startTime,
          endTime: session.endTime,
          organization: new Types.ObjectId(organizationId),
          user: new Types.ObjectId(userId),
          application: app._id,
          pid: session.pid,
          browserUrl: session.browserUrl || null,
          faviconUrl: session.faviconUrl || null,
        });
      }

      if (enrichedSessions.length > 0) {
        const created = await this.activityModel.insertMany(enrichedSessions);
        this.logger.debug('Created Activities:', created);
        return created;
      } else {
        return []; // Nothing to insert
      }
    } catch (error) {
      this.logger.error('Failed to create activities', error.message);
      throw error;
    }
  }

  // Ignore testing this function
  async findAllActivities(
    organizationUserId: string,
    userId: string,
    date: string,
    timezoneOffset: string = '+00:00', // default fallback
  ) {
    try {
      const query: any = {
        // organizationUserRole: organizationUserId,
      };

      // Validate timezoneOffset format (e.g. +06:00 or -05:30)
      if (!/^[-+]\d{2}:\d{2}$/.test(timezoneOffset)) {
        timezoneOffset = '+00:00'; // fallback to UTC
      }

      this.logger.log('Date:', date);
      this.logger.log('Timezone Offset:', timezoneOffset);

      // Use today's date in the user's timezone if not provided
      if (!date) {
        const now = moment().utcOffset(timezoneOffset);
        date = now.format('YYYY-MM-DD');
      }

      const isoStart = `${date}T00:00:00${timezoneOffset}`;
      const isoEnd = `${date}T23:59:59.999${timezoneOffset}`;

      this.logger.log('ISO Start:', isoStart);
      this.logger.log('ISO End:', isoEnd);

      const startOfDayUTC = moment.parseZone(isoStart).utc().toISOString();
      const endOfDayUTC = moment.parseZone(isoEnd).utc().toISOString();

      this.logger.log('Start of Day UTC:', startOfDayUTC);
      this.logger.log('End of Day UTC:', endOfDayUTC);

      query.startTime = {
        $gte: startOfDayUTC,
        $lte: endOfDayUTC,
      };

      const activities = await this.activityModel.find(query);
      return activities;
    } catch (error) {
      this.logger.error('Failed to find activities', error.message);
      throw error;
    }
  }

  // async findUnreportedActivitiesForCurrentUser(
  //   userId: string,
  //   organizationId: string,
  //   date: string,
  //   timezoneRegion: string,
  //   sortOrder: 'latest' | 'oldest' = 'latest',
  //   page: number = 1,
  //   limit: number = 10,
  // ) {
  //   try {
  //     await this.organizationService.verifyUserofOrg(userId, organizationId);

  //     // // Validate timezoneOffset
  //     // if (!/^[-+]\d{2}:\d{2}$/.test(timezoneOffset)) {
  //     //   timezoneOffset = '+00:00';
  //     // }

  //     // Use today's date if not provided
  //     if (!date) {
  //       const now = moment().tz(timezoneRegion);
  //       date = now.format('YYYY-MM-DD');
  //     }

  //     // Use moment.tz to create start and end of day in that timezone
  //     const startOfDay = moment.tz(`${date}T00:00:00`, timezoneRegion);
  //     const endOfDay = moment.tz(`${date}T23:59:59.999`, timezoneRegion);

  //     // Log local times
  //     this.logger.log('Start of Day (local):', startOfDay.format());
  //     this.logger.log('End of Day (local):', endOfDay.format());

  //     // Convert to UTC
  //     const startOfDayUTC = startOfDay.utc().toISOString();
  //     const endOfDayUTC = endOfDay.utc().toISOString();

  //     this.logger.log('Start of Day UTC:', startOfDayUTC);
  //     this.logger.log('End of Day UTC:', endOfDayUTC);

  //     const sortDirection = sortOrder === 'latest' ? -1 : 1;
  //     const skip = (page - 1) * limit;
  //     // this.logger.log('limit:', limit);
  //     // this.logger.log('page:', page);
  //     // this.logger.log('Skip:', skip);

  //     const unreportedActivities = await this.activityModel.aggregate([
  //       {
  //         $match: {
  //           user: new Types.ObjectId(userId),
  //           organization: new Types.ObjectId(organizationId),
  //           // $expr: {
  //           //   $and: [
  //           //     { $gte: ['$startTime', startOfDayUTC] },
  //           //     { $lte: ['$startTime', endOfDayUTC] },
  //           //   ],
  //           // },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: 'worksheetactivities',
  //           localField: '_id',
  //           foreignField: 'activity',
  //           as: 'reported',
  //         },
  //       },
  //       {
  //         $match: {
  //           reported: { $size: 0 },
  //         },
  //       },
  //       {
  //         $project: {
  //           reported: 0,
  //         },
  //       },
  //       {
  //         $sort: {
  //           startTime: sortDirection,
  //         },
  //       },
  //       {
  //         $facet: {
  //           data: [
  //             { $sort: { startTime: sortOrder === 'latest' ? -1 : 1 } },
  //             { $skip: skip },
  //             { $limit: limit },
  //           ],
  //           totalCount: [{ $count: 'count' }],
  //         },
  //       },
  //     ]);

  //     this.logger.debug('Unreported Activities:', unreportedActivities);

  //     const paginated = unreportedActivities[0];
  //     const activities = paginated.data;
  //     const totalCount = paginated.totalCount[0]?.count || 0;

  //     return {
  //       data: activities,
  //       paginationMetadata: {
  //         page,
  //         limit,
  //         totalCount,
  //         totalPages: Math.ceil(totalCount / limit),
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error('Failed to find unreported activities', error.message);
  //     throw error;
  //   }
  // }

  async findUnreportedActivitiesForCurrentUser(
    userId: string,
    organizationId: string,
    date: string,
    timezoneRegion: string,
    sortOrder: 'latest' | 'oldest' = 'latest',
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      await this.organizationService.verifyUserofOrg(userId, organizationId);

      if (!date) {
        const now = moment().tz(timezoneRegion);
        date = now.format('YYYY-MM-DD');
      }

      const startOfDay = moment.tz(`${date}T00:00:00`, timezoneRegion).utc().toDate();
      const endOfDay = moment.tz(`${date}T23:59:59.999`, timezoneRegion).utc().toDate();

      this.logger.debug('Start of Day UTC:', startOfDay);
      this.logger.debug('End of Day UTC:', endOfDay);

      const sortDirection = sortOrder === 'latest' ? -1 : 1;
      const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);

      const result = await this.activityModel.aggregate([
        {
          $match: {
            user: new Types.ObjectId(userId),
            organization: new Types.ObjectId(organizationId),
            startTime: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $lookup: {
            from: 'worksheetactivities',
            localField: '_id',
            foreignField: 'activity',
            as: 'reported',
          },
        },
        {
          $match: {
            reported: { $size: 0 },
          },
        },
        {
          $lookup: {
            from: 'applications',
            localField: 'application',
            foreignField: '_id',
            as: 'application',
          },
        },
        {
          $unwind: {
            path: '$application',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            icon: {
              $cond: {
                if: { $ifNull: ['$faviconUrl', false] },
                then: '$faviconUrl',
                else: '$application.icon',
              },
            },
          },
        },
        {
          $facet: {
            data: [
              { $sort: { startTime: sortDirection } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  startTime: 1,
                  endTime: 1,
                  icon: 1,
                },
              },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]);

      const activities = result[0]?.data || [];
      const totalCount = result[0]?.totalCount[0]?.count || 0;

      const transformed = activities.map((activity) => ({
        ...activity,
        timeSpent: calculateTimeSpent(activity.startTime, activity.endTime),
      }));

      return {
        data: transformed,
        paginationMetadata: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Failed to find unreported activities', error.message);
      throw new InternalServerErrorException('Unable to fetch unreported activities.');
    }
  }


  async validateActivitiesForUser(
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
    activityIds: string[],
  ) {
    try {
      // Ensure each ID is strictly a valid 24-char hex ObjectId
      for (const id of activityIds) {
        if (
          !Types.ObjectId.isValid(id) ||
          new Types.ObjectId(id).toHexString() !== id
        ) {
          throw new BadRequestException(`Invalid activityId: ${id}`);
        }
      }

      const activityObjectIds = activityIds.map((id) => new Types.ObjectId(id));

      this.logger.debug('Activity Object IDs:', activityObjectIds);
      this.logger.debug('User ID:', userId);
      this.logger.debug('Organization ID:', organizationId);

      const validActivities = await this.activityModel.find({
        _id: { $in: activityObjectIds },
        user: userId,
        organization: organizationId,
      });

      this.logger.debug('Valid Activities:', validActivities);

      if (validActivities.length !== activityIds.length) {
        throw new BadRequestException(
          'Some activities are invalid or unauthorized.',
        );
      }

      return validActivities;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Activity validation failed', error);
      throw new InternalServerErrorException('Activity validation failed');
    }
  }
}
