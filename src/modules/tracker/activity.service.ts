import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ActivityLogEntryDto, CreateActivitiesDto } from './dto/create-activities.dto';
import { Activity } from './entities/activity.schema';
import mongoose, { isValidObjectId, Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import 'moment-timezone';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActivitySession } from './tracker.interface';
import { ApplicationService } from './application.service';
import { calculateTimeSpent } from './time.utils';
import { CreateManualActivityDto } from './dto/create-manaul-activity.dto';
import { UpdateManualActivityDto } from './dto/update-manaul-activity.dto';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<Activity>,

    @InjectQueue('activity-log')
    private readonly activityLogQueue: Queue,

    private readonly applicationService: ApplicationService,
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
          manualType: { $exists: false },
        })
        .sort({ endTime: -1 });

      for (const session of activitySessions) {
        if (latest && new Date(session.startTime) <= new Date(latest.endTime)) {
          continue;
        }
        const app = await this.applicationService.findOrCreate(session.appName, session.faviconUrl);

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

  async createManualActivity(
    createManualActivityDto: CreateManualActivityDto,
    userId: string,
    organizationId: string,
  ) {
    try {
      const { name, startTime, endTime, manualType } = createManualActivityDto;

      if (new Date(endTime) <= new Date(startTime)) {
        throw new BadRequestException('End time must be after start time.');
      }

      const activity = await this.activityModel.insertOne({
        name,
        startTime,
        endTime,
        organization: new Types.ObjectId(organizationId),
        user: new Types.ObjectId(userId),
        manualType,
      });

      return activity;
    } catch (error) {
      this.logger.error('Failed to create manual activity', error.message);
      throw error;
    }
  }

  async editManualActivity(
    activityId: string,
    userId: string,
    organizationId: string,
    updateDto: UpdateManualActivityDto,
  ): Promise<Activity> {
    try {
      if (!isValidObjectId(activityId)) {
        throw new BadRequestException('Invalid activity ID format.');
      }

      const activity = await this.activityModel.findOne({
        _id: new Types.ObjectId(activityId),
      });

      if (!activity) {
        throw new NotFoundException('Manual activity not found.');
      }

      if (
        activity.user.toString() !== userId ||
        activity.organization.toString() !== organizationId
      ) {
        throw new UnauthorizedException('You do not have permission to edit this activity.');
      }

      if (activity.manualType == undefined) {
        throw new BadRequestException(
          'This activity is not a manual activity and cannot be edited.',
        );
      }

      const { name, manualType, startTime, endTime } = updateDto;

      if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
        throw new BadRequestException('End time must be after start time.');
      }

      if (name !== undefined) activity.name = name;
      if (manualType !== undefined) activity.manualType = manualType;
      if (startTime !== undefined) activity.startTime = new Date(startTime);
      if (endTime !== undefined) activity.endTime = new Date(endTime);

      await activity.save();
      return activity;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Failed to update manual activity', error.message);
      throw new InternalServerErrorException('Could not update manual activity');
    }
  }

  // istanbul ignore next
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
                  manualType: 1,
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
        if (!Types.ObjectId.isValid(id) || new Types.ObjectId(id).toHexString() !== id) {
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
        throw new BadRequestException('Some activities are invalid or unauthorized.');
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
