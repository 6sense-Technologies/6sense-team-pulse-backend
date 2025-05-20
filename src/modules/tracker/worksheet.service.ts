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
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Application } from './entities/application.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActivitySession } from './tracker.interface';
import { OrganizationService } from '../organization/organization.service';
import { ApplicationService } from './application.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { ActivityService } from './activity.service';
import { AssignActivitiesDto } from './dto/assign-activities.dto';

@Injectable()
export class WorksheetService {
  private readonly logger = new Logger(WorksheetService.name);
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<Activity>,

    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,

    @InjectModel(Worksheet.name)
    private readonly worksheetModel: Model<Worksheet>,

    @InjectModel(WorksheetActivity.name)
    private readonly worksheetActivityModel: Model<WorksheetActivity>, // Replace 'any' with the actual type if available

    @InjectQueue('activity-log')
    private readonly activityLogQueue: Queue,

    @InjectConnection()
    private readonly connection: Connection,

    private readonly applicationService: ApplicationService,
    private readonly organizationService: OrganizationService,
    private readonly activityService: ActivityService,
  ) {}

  async getWorksheetNames(
    userId: string,
    organizationId: string,
    projectId: string,
    name: string,
    date: string,
  ) {
    try {
      const worksheets = await this.worksheetModel.aggregate([
        {
          $match: {
            user: new Types.ObjectId(userId),
            organization: new Types.ObjectId(organizationId),
            project: new Types.ObjectId(projectId),
            name: { $regex: new RegExp(name, 'i') },
            date: date, // assuming this is stored as a Date in DB
          },
        },
        {
          $lookup: {
            from: 'worksheetactivities',
            localField: '_id',
            foreignField: 'worksheet',
            as: 'worksheetActivities',
          },
        },
        {
          $unwind: {
            path: '$worksheetActivities',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'activities',
            localField: 'worksheetActivities.activity',
            foreignField: '_id',
            as: 'activity',
          },
        },
        { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            activityDurationSeconds: {
              $cond: {
                if: { $and: ['$activity.startTime', '$activity.endTime'] },
                then: {
                  $divide: [
                    { $subtract: ['$activity.endTime', '$activity.startTime'] },
                    1000,
                  ],
                },
                else: 0,
              },
            },
          },
        },

        {
          $group: {
            _id: {
              worksheetId: '$_id',
              name: '$name',
              lastReportedOn: '$lastReportedOn',
            },
            totalActivities: { $sum: 1 },
            totalLoggedSeconds: { $sum: '$activityDurationSeconds' },
          },
        },

        {
          $project: {
            _id: 0,
            name: '$_id.name',
            date: date,
            lastReportedOn: '$_id.lastReportedOn',
            totalActivities: 1,
            totalLoggedTime: {
              totalSeconds: '$totalLoggedSeconds',
              hours: { $floor: { $divide: ['$totalLoggedSeconds', 3600] } },
              minutes: {
                $floor: {
                  $divide: [{ $mod: ['$totalLoggedSeconds', 3600] }, 60],
                },
              },
              seconds: { $mod: ['$totalLoggedSeconds', 60] },
            },
          },
        },

        { $sort: { name: 1 } },
      ]);

      return worksheets;
    } catch (error) {
      this.logger.error('Failed to get worksheet names', {
        userId,
        organizationId,
        projectId,
        name,
        date,
        error: error.message,
      });
      throw new InternalServerErrorException(
        'Unable to retrieve worksheet summary',
      );
    }
  }

  async assignActivitiesToWorksheet(
    userId: string,
    organizationId: string,
    assignActivitiesDto: AssignActivitiesDto,
  ) {
    const { projectId, worksheetName, activityIds, date } = assignActivitiesDto;

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Validate ObjectIds
      if (!isValidObjectId(userId))
        throw new BadRequestException('Invalid userId');
      if (!isValidObjectId(organizationId))
        throw new BadRequestException('Invalid organizationId');
      if (!isValidObjectId(projectId))
        throw new BadRequestException('Invalid projectId');

      const userObjectId = new Types.ObjectId(userId);
      const organizationObjectId = new Types.ObjectId(organizationId);
      const projectObjectId = new Types.ObjectId(projectId);

      const validityOfOrgaizationUser =
        await this.organizationService.verifyUserofOrg(userId, organizationId);

      if (!validityOfOrgaizationUser) {
        throw new UnauthorizedException(
          `Invalid userId or organizationId: userId=${userId}, organizationId=${organizationId}`,
        );
      }

      // Find or create worksheet with upsert
      const worksheet = await this.worksheetModel.findOneAndUpdate(
        {
          name: worksheetName,
          user: userObjectId,
          organization: organizationObjectId,
          project: projectObjectId,
          date: date,
        },
        {
          $setOnInsert: {
            name: worksheetName,
            user: userObjectId,
            organization: organizationObjectId,
            project: projectObjectId,
            date: date,
          },
        },
        {
          upsert: true,
          new: true,
          session,
        },
      );

      // Validate activities belong to user/org
      const validActivities =
        await this.activityService.validateActivitiesForUser(
          userObjectId,
          organizationObjectId,
          activityIds,
        );

      const activityIdsToCheck = validActivities.map((a) => a._id);

      // Find already linked activities
      const alreadyLinked = await this.worksheetActivityModel.find({
        activity: { $in: activityIdsToCheck },
      });

      if (alreadyLinked.length > 0) {
        this.logger.debug(
          `Already linked activities: ${alreadyLinked.map((a) => a.activity.toString())}`,
        );
        throw new BadRequestException(
          'One or more activities are already linked to a worksheet.',
        );
      }

      const alreadyLinkedSet = new Set(
        alreadyLinked.map((a) => a.activity.toString()),
      );

      // Filter unlinked activities
      const unlinkedActivities = validActivities.filter(
        (a) => !alreadyLinkedSet.has(a._id.toString()),
      );

      // Prepare links
      const links = unlinkedActivities.map((activity) => ({
        activity: activity._id,
        worksheet: worksheet._id,
      }));

      // Insert new links
      try {
        await this.worksheetActivityModel.insertMany(links, {
          ordered: false,
          session,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }

      await session.commitTransaction();
      session.endSession();

      return {
        worksheetId: worksheet._id,
        addedActivities: unlinkedActivities.length,
        skippedActivities: validActivities.length - unlinkedActivities.length,
      };
    } catch (error) {
      this.logger.error('Failed to assign activities to worksheet', {
        userId,
        organizationId,
        projectId,
        worksheetName,
        activityIds,
        error: error.message,
      });
      await session.abortTransaction();
      session.endSession();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Could not assign activities to worksheet',
      );
    }
  }

  async getActivitiesForWorksheet(
    userId: string,
    organizationId: string,
    worksheetId: string,
    timezoneRegion: string = 'UTC',
    page: number = 1,
    limit: number = 10,
    sortOrder: 'latest' | 'oldest' = 'latest',
  ) {
    try {
      await this.organizationService.verifyUserofOrg(userId, organizationId);

      const worksheet = await this.worksheetModel.findById(worksheetId);
      if (!worksheet) {
        throw new BadRequestException('Worksheet not found.');
      }

      if (
        worksheet.user.toString() !== userId ||
        worksheet.organization.toString() !== organizationId
      ) {
        throw new UnauthorizedException(
          'You are not authorized to access this worksheet.',
        );
      }

      const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);
      const sortDirection = sortOrder === 'latest' ? -1 : 1;

      const result = await this.worksheetActivityModel.aggregate([
        { $match: { worksheet: new Types.ObjectId(worksheetId) } },

        {
          $lookup: {
            from: 'activities',
            localField: 'activity',
            foreignField: '_id',
            as: 'activity',
          },
        },
        { $unwind: '$activity' },

        {
          $match: {
            'activity.user': new Types.ObjectId(userId),
            'activity.organization': new Types.ObjectId(organizationId),
          },
        },

        {
          $lookup: {
            from: 'applications',
            localField: 'activity.application',
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
                if: { $ifNull: ['$activity.faviconUrl', false] },
                then: '$activity.faviconUrl',
                else: '$application.icon',
              },
            },
          },
        },

        {
          $facet: {
            data: [
              { $sort: { 'activity.startTime': sortDirection } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  name: '$activity.name',
                  startTime: '$activity.startTime',
                  endTime: '$activity.endTime',
                  icon: 1,
                },
              },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]);

      const activities = result[0].data || [];
      const totalCount = result[0].totalCount[0]?.count || 0;

      const transformed = activities.map((wa) => ({
        name: wa.name,
        startTime: wa.startTime,
        endTime: wa.endTime,
        icon: wa.icon,
        timeSpent: this.calculateTimeSpent(wa.startTime, wa.endTime),
      }));

      return {
        worksheetId: worksheet._id,
        lastReportedOn: worksheet['updatedAt'],
        data: transformed,
        paginationMetadata: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching worksheet activities:', {
        userId,
        organizationId,
        worksheetId,
        timezoneRegion,
        error: error.message,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to fetch activities for worksheet.',
      );
    }
  }

  private calculateTimeSpent(start: Date, end: Date) {
    if (!start || !end) {
      return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
    }

    const duration = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000,
    );
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    return {
      hours,
      minutes,
      seconds,
      totalSeconds: duration,
    };
  }

  async getWorksheets(
    userId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    sortOrder: 'latest' | 'oldest' = 'latest',
    startDate?: string,
    endDate?: string,
  ) {
    try {
      await this.organizationService.verifyUserofOrg(userId, organizationId);

      const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);
      const sortDirection = sortOrder === 'latest' ? -1 : 1;

      const dateMatch: any = {};
      if (startDate) dateMatch.$gte = startDate;
      if (endDate) dateMatch.$lte = endDate;

      const matchStage: any = {
        user: new Types.ObjectId(userId),
        organization: new Types.ObjectId(organizationId),
      };
      if (Object.keys(dateMatch).length > 0) {
        matchStage.date = dateMatch;
      }

      const result = await this.worksheetModel.aggregate([
        { $match: matchStage },

        // project lookup
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'project',
          },
        },
        {
          $unwind: {
            path: '$project',
            preserveNullAndEmptyArrays: true,
          },
        },

        // activities + duration
        {
          $lookup: {
            from: 'worksheetactivities',
            localField: '_id',
            foreignField: 'worksheet',
            as: 'worksheetActivities',
          },
        },
        {
          $unwind: {
            path: '$worksheetActivities',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'activities',
            localField: 'worksheetActivities.activity',
            foreignField: '_id',
            as: 'activity',
          },
        },
        { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            activityDurationSeconds: {
              $cond: {
                if: { $and: ['$activity.startTime', '$activity.endTime'] },
                then: {
                  $divide: [
                    { $subtract: ['$activity.endTime', '$activity.startTime'] },
                    1000,
                  ],
                },
                else: 0,
              },
            },
          },
        },

        // grouping
        {
          $group: {
            _id: {
              worksheetId: '$_id',
              name: '$name',
              date: '$date',
              projectName: '$project.name',
            },
            totalLoggedSeconds: { $sum: '$activityDurationSeconds' },
          },
        },

        // final projection
        {
          $project: {
            _id: 0,
            worksheetId: '$_id.worksheetId',
            name: '$_id.name',
            date: '$_id.date',
            projectName: '$_id.projectName',
            totalLoggedTime: {
              totalSeconds: '$totalLoggedSeconds',
              hours: { $floor: { $divide: ['$totalLoggedSeconds', 3600] } },
              minutes: {
                $floor: {
                  $divide: [{ $mod: ['$totalLoggedSeconds', 3600] }, 60],
                },
              },
              seconds: { $mod: ['$totalLoggedSeconds', 60] },
            },
          },
        },

        // sorting + pagination
        { $sort: { date: sortDirection } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]);

      const worksheets = result[0]?.data || [];
      const totalCount = result[0]?.totalCount[0]?.count || 0;

      return {
        data: worksheets,
        paginationMetadata: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch worksheets', {
        userId,
        organizationId,
        startDate,
        endDate,
        error: error.message,
      });
      throw new InternalServerErrorException('Unable to retrieve worksheets.');
    }
  }
}
