import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { OrganizationService } from '../organization/organization.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { ActivityService } from './activity.service';
import { AssignActivitiesDto } from './dto/assign-activities.dto';
import { calculateTimeSpent } from './time.utils';

@Injectable()
export class WorksheetService {
  private readonly logger = new Logger(WorksheetService.name);
  constructor(
    @InjectModel(Worksheet.name)
    private readonly worksheetModel: Model<Worksheet>,

    @InjectModel(WorksheetActivity.name)
    private readonly worksheetActivityModel: Model<WorksheetActivity>, // Replace 'any' with the actual type if available

    @InjectConnection()
    private readonly connection: Connection,

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
      const userObjectId = new Types.ObjectId(userId);
      const organizationObjectId = new Types.ObjectId(organizationId);
      const projectObjectId = new Types.ObjectId(projectId);

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

  async removeActivitiesFromWorksheet(
    userId: string,
    organizationId: string,
    worksheetId: string,
    activityIds: string[],
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const worksheet = await this.worksheetModel.findById(worksheetId);

      if (!worksheet) {
        throw new NotFoundException('Worksheet not found.');
      }

      if (
        worksheet.user.toString() !== userId ||
        worksheet.organization.toString() !== organizationId
      ) {
        throw new UnauthorizedException(
          'You are not authorized to remove activities from this worksheet.',
        );
      }

      const activityObjectIds = activityIds.map((id) => new Types.ObjectId(id));

      // 🔍 Validate that all activityIds belong to this worksheet
      const validLinks = await this.worksheetActivityModel
        .find({
          worksheet: worksheet._id,
          activity: { $in: activityObjectIds },
        })
        .session(session);

      const validActivityIds = validLinks.map((link) =>
        link.activity.toString(),
      );
      if (validActivityIds.length !== activityIds.length) {
        throw new BadRequestException(
          'One or more activities are not part of this worksheet.',
        );
      }

      // 🧹 Remove valid activities
      const result = await this.worksheetActivityModel
        .deleteMany({
          worksheet: worksheet._id,
          activity: { $in: activityObjectIds },
        })
        .session(session);

      // 📉 Check if worksheet has any activities left
      const remainingActivities = await this.worksheetActivityModel
        .countDocuments({ worksheet: worksheet._id })
        .session(session);

      // 🗑️ If no activities left, remove the worksheet itself
      if (remainingActivities === 0) {
        await this.worksheetModel
          .deleteOne({ _id: worksheet._id })
          .session(session);
      }

      await session.commitTransaction();
      session.endSession();

      return {
        worksheetId: worksheet._id,
        removedCount: result.deletedCount,
        worksheetDeleted: remainingActivities === 0,
      };
    } catch (error) {
      this.logger.error('Failed to remove activities from worksheet', {
        userId,
        organizationId,
        worksheetId,
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
        'Could not remove activities from worksheet',
      );
    }
  }

  // istanbul ignore next
  async getActivitiesForWorksheetold(
    userId: string,
    organizationId: string,
    worksheetId: string,
    timezoneRegion: string = 'UTC',
    page: number = 1,
    limit: number = 10,
    sortOrder: 'latest' | 'oldest' = 'latest',
  ) {
    try {
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
        timeSpent: calculateTimeSpent(wa.startTime, wa.endTime),
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

  async getActivitiesForWorksheet(
    requesterId: string,
    organizationId: string,
    worksheetId: string,
    page: number = 1,
    limit: number = 10,
    sortOrder: 'latest' | 'oldest' = 'latest',
    search?: string,
    isAdmin: boolean = false,
  ): Promise<any> {
    try {
      // Populate just user's name and profilePic
      const worksheet = await this.worksheetModel
        .findById(worksheetId)
        .populate('user', 'displayName avatarUrls')
        .populate('project', 'name')
        .exec();

      if (!worksheet) {
        throw new NotFoundException('Worksheet not found.');
      }

      if (worksheet.organization.toString() !== organizationId) {
        throw new UnauthorizedException('Invalid organization access.');
      }

      const isOwner = requesterId === worksheet.user._id.toString();

      if (!isOwner) {
        if (!isAdmin) {
          throw new UnauthorizedException(
            'You are not authorized to view this worksheet.',
          );
        }

        // Check if requester is part of the worksheet's project using aggregation
        const projectAccess = await this.worksheetModel.aggregate([
          {
            $match: {
              _id: new Types.ObjectId(worksheetId),
              organization: new Types.ObjectId(organizationId),
            },
          },
          {
            $lookup: {
              from: 'organizationprojectusers',
              localField: 'project',
              foreignField: 'project',
              as: 'memberships',
            },
          },
          { $unwind: '$memberships' },
          {
            $match: {
              'memberships.user': new Types.ObjectId(requesterId),
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ]);

        if (!projectAccess.length) {
          throw new UnauthorizedException(
            'Admin is not a member of the worksheet project.',
          );
        }
      }

      const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);
      const sortDirection = sortOrder === 'latest' ? -1 : 1;

      const searchMatch = search
        ? { 'activity.name': { $regex: search, $options: 'i' } }
        : {};

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
            'activity.user': new Types.ObjectId(worksheet.user._id.toString()),
            'activity.organization': new Types.ObjectId(organizationId),
            ...searchMatch,
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
            timeSpentSeconds: {
              $divide: [
                { $subtract: ['$activity.endTime', '$activity.startTime'] },
                1000,
              ],
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
                  _id: '$activity._id',
                  name: '$activity.name',
                  startTime: '$activity.startTime',
                  endTime: '$activity.endTime',
                  icon: 1,
                  manualType: '$activity.manualType',
                  timeSpentSeconds: 1,
                },
              },
            ],
            totalCount: [{ $count: 'count' }],
            totalTime: [
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: '$timeSpentSeconds' },
                },
              },
            ],
          },
        },
      ]);

      const activities = result[0].data || [];
      const totalCount = result[0].totalCount[0]?.count || 0;
      const totalSeconds = Math.floor(
        result[0].totalTime[0]?.totalSeconds || 0,
      );

      const { hours, minutes, seconds } = calculateTimeSpent(
        new Date(0),
        new Date(totalSeconds * 1000),
      );

      const transformed = activities.map((wa) => ({
        _id: wa._id,
        name: wa.name,
        startTime: wa.startTime,
        endTime: wa.endTime,
        icon: wa.icon,
        manualType: wa.manualType,
        timeSpent: calculateTimeSpent(wa.startTime, wa.endTime),
      }));

      return {
        worksheetId: worksheet._id,
        worksheetName: worksheet.name,
        projectName: worksheet.project.name,
        lastReportedOn: worksheet.lastReportedOn,
        reportedBy: {
          userId: worksheet.user._id,
          name: worksheet.user.displayName || 'Unknown',
          profilePic: worksheet.user.avatarUrls || null,
        },
        data: transformed,
        totalLoggedTime: {
          totalSeconds,
          hours,
          minutes,
          seconds,
        },
        paginationMetadata: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching worksheet activities', {
        requesterId,
        worksheetId,
        isAdmin,
        error: error.message,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        error.getStatus = () => 200; // Ensure NotFoundException returns 404 status
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to fetch activities for worksheet.',
      );
    }
  }

  // private calculateTimeSpent(start: Date, end: Date) {
  //   if (!start || !end) {
  //     return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  //   }

  //   const duration = Math.floor(
  //     (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  //   );
  //   const hours = Math.floor(duration / 3600);
  //   const minutes = Math.floor((duration % 3600) / 60);
  //   const seconds = duration % 60;

  //   return {
  //     hours,
  //     minutes,
  //     seconds,
  //     totalSeconds: duration,
  //   };
  // }

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

      const rawData = await this.worksheetModel.aggregate([
        { $match: matchStage },

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

        { $sort: { date: sortDirection } },
      ]);

      // Group and calculate durations in TypeScript
      const grouped: Record<string, any> = {};

      for (const item of rawData) {
        const worksheetId = item._id.toString();

        if (!grouped[worksheetId]) {
          const [year, month, day] = item.date.split('-');
          grouped[worksheetId] = {
            worksheetId: item._id,
            name: item.name,
            date: `${day}-${month}-${year}`,
            projectName: item.project?.name || null,
            totalSeconds: 0,
          };
        }

        const start = item.activity?.startTime
          ? new Date(item.activity.startTime)
          : null;
        const end = item.activity?.endTime
          ? new Date(item.activity.endTime)
          : null;

        const timeSpent = calculateTimeSpent(start, end);
        grouped[worksheetId].totalSeconds += timeSpent.totalSeconds;
      }

      const allWorksheets = Object.values(grouped).map((ws: any) => {
        const { hours, minutes, seconds, totalSeconds } = calculateTimeSpent(
          new Date(0),
          new Date(ws.totalSeconds * 1000),
        );

        return {
          worksheetId: ws.worksheetId,
          name: ws.name,
          date: ws.date,
          projectName: ws.projectName,
          totalLoggedTime: {
            totalSeconds,
            hours,
            minutes,
            seconds,
          },
        };
      });

      // Pagination on grouped results
      const paginated = allWorksheets.slice(skip, skip + limit);
      const totalCount = allWorksheets.length;

      return {
        data: paginated,
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

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Unable to retrieve worksheets.');
    }
  }

  async getProjectMemberWorksheets(
    projectId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: 'duration' | 'reportedTime' = 'reportedTime',
    sortOrder: 'oldest' | 'latest' = 'latest',
    startDate?: string,
    endDate?: string,
    search?: string,
  ) {
    try {
      const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);
      const sortMultiplier = sortOrder === 'oldest' ? 1 : -1;

      const matchStage: any = {
        organization: new Types.ObjectId(organizationId),
        project: new Types.ObjectId(projectId),
      };

      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) matchStage.date.$lte = new Date(endDate);
      }

      if (search) {
        matchStage.name = { $regex: search, $options: 'i' }; // partial, case-insensitive
      }

      const rawData = await this.worksheetModel.aggregate([
        { $match: matchStage },

        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'project',
          },
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },

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
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]);

      // Grouping + processing
      const grouped: Record<string, any> = {};

      for (const item of rawData) {
        const worksheetId = item._id.toString();

        if (!grouped[worksheetId]) {
          grouped[worksheetId] = {
            worksheetId: item._id,
            name: item.name,
            date: item.date,
            createdAt: item.createdAt,
            projectName: item.project?.name || null,
            totalSeconds: 0,
            totalActivities: 0,
            containsManualActivity: false,
            user: {
              _id: item.user?._id,
              displayName: item.user?.displayName,
              avatarUrls: item.user?.avatarUrls,
            },
          };
        }

        const activity = item.activity;
        if (activity) {
          const start = activity.startTime
            ? new Date(activity.startTime)
            : null;
          const end = activity.endTime ? new Date(activity.endTime) : null;

          const timeSpent = calculateTimeSpent(start, end);
          grouped[worksheetId].totalSeconds += timeSpent.totalSeconds;
          grouped[worksheetId].totalActivities += 1;

          if (activity.manualType) {
            grouped[worksheetId].containsManualActivity = true;
          }
        }
      }

      const allWorksheets = Object.values(grouped).map((ws: any) => {
        const { hours, minutes, seconds, totalSeconds } = calculateTimeSpent(
          new Date(0),
          new Date(ws.totalSeconds * 1000),
        );

        return {
          worksheetId: ws.worksheetId,
          name: ws.name,
          date: ws.date,
          createdAt: ws.createdAt,
          projectName: ws.projectName,
          containsManualActivity: ws.containsManualActivity,
          totalActivities: ws.totalActivities,
          totalLoggedTime: {
            totalSeconds,
            hours,
            minutes,
            seconds,
          },
          user: ws.user,
        };
      });

      // Sorting
      allWorksheets.sort((a, b) => {
        const valA =
          sortBy === 'duration'
            ? a.totalLoggedTime.totalSeconds
            : new Date(a.createdAt).getTime();
        const valB =
          sortBy === 'duration'
            ? b.totalLoggedTime.totalSeconds
            : new Date(b.createdAt).getTime();

        return sortMultiplier * (valA - valB);
      });

      // Pagination
      const paginated = allWorksheets.slice(skip, skip + limit);
      const totalCount = allWorksheets.length;

      return {
        data: paginated,
        paginationMetadata: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch project member worksheets', {
        projectId,
        organizationId,
        startDate,
        endDate,
        error: error.message,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to retrieve project worksheets.',
      );
    }
  }

  async getProjectWorksheetAnalytics(
    projectId: string,
    organizationId: string,
  ): Promise<{
    today: ReturnType<typeof calculateTimeSpent> & {
      percentChangeFromYesterday: number;
    };
    thisWeek: ReturnType<typeof calculateTimeSpent> & {
      percentChangeFromLastWeek: number;
    };
    thisMonth: ReturnType<typeof calculateTimeSpent> & {
      percentChangeFromLastMonth: number;
    };
    allTime: ReturnType<typeof calculateTimeSpent>;
  }> {
    try {
      const now = new Date();

      // Time boundaries
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(todayStart.getDate() - 1);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Sunday

      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(weekStart.getDate() - 7);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(monthStart);

      const getActivityDurations = async (
        start: Date,
        end: Date,
      ): Promise<Array<{ startTime: Date; endTime: Date }>> => {
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];

        return await this.worksheetModel.aggregate([
          {
            $match: {
              organization: new Types.ObjectId(organizationId),
              project: new Types.ObjectId(projectId),
              date: { $gt: startDateStr, $lte: endDateStr },
            },
          },
          {
            $lookup: {
              from: 'worksheetactivities',
              localField: '_id',
              foreignField: 'worksheet',
              as: 'activities',
            },
          },
          {
            $unwind: { path: '$activities', preserveNullAndEmptyArrays: true },
          },
          {
            $lookup: {
              from: 'activities',
              localField: 'activities.activity',
              foreignField: '_id',
              as: 'activityDetails',
            },
          },
          {
            $unwind: {
              path: '$activityDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              startTime: '$activityDetails.startTime',
              endTime: '$activityDetails.endTime',
            },
          },
        ]);
      };

      const [
        todayDurations,
        yesterdayDurations,
        thisWeekDurations,
        lastWeekDurations,
        thisMonthDurations,
        lastMonthDurations,
        allTimeDurations,
      ] = await Promise.all([
        getActivityDurations(todayStart, now),
        getActivityDurations(yesterdayStart, todayStart),
        getActivityDurations(weekStart, now),
        getActivityDurations(lastWeekStart, weekStart),
        getActivityDurations(monthStart, now),
        getActivityDurations(lastMonthStart, lastMonthEnd),
        getActivityDurations(new Date(0), now),
      ]);

      const sumDurations = (
        activities: { startTime: Date; endTime: Date }[],
      ) => {
        let totalSeconds = 0;
        for (const a of activities) {
          if (!a.startTime || !a.endTime) {
            this.logger.warn(
              `Skipping activity with missing times: ${JSON.stringify(a)}`,
            );
            continue;
          }
          const { totalSeconds: seconds } = calculateTimeSpent(
            new Date(a.startTime),
            new Date(a.endTime),
          );
          totalSeconds += seconds;
        }
        return calculateTimeSpent(new Date(0), new Date(totalSeconds * 1000));
      };

      const today = sumDurations(todayDurations);
      const yesterday = sumDurations(yesterdayDurations);
      const thisWeek = sumDurations(thisWeekDurations);
      const lastWeek = sumDurations(lastWeekDurations);
      const thisMonth = sumDurations(thisMonthDurations);
      const lastMonth = sumDurations(lastMonthDurations);
      const allTime = sumDurations(allTimeDurations);

      const computePercentChange = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) return current === 0 ? 0 : 100;
        return ((current - previous) / previous) * 100;
      };

      return {
        today: {
          ...today,
          percentChangeFromYesterday: computePercentChange(
            today.totalSeconds,
            yesterday.totalSeconds,
          ),
        },
        thisWeek: {
          ...thisWeek,
          percentChangeFromLastWeek: computePercentChange(
            thisWeek.totalSeconds,
            lastWeek.totalSeconds,
          ),
        },
        thisMonth: {
          ...thisMonth,
          percentChangeFromLastMonth: computePercentChange(
            thisMonth.totalSeconds,
            lastMonth.totalSeconds,
          ),
        },
        allTime: allTime,
      };
    } catch (error) {
      this.logger.error('Failed to compute worksheet analytics', {
        projectId,
        organizationId,
        error: error.message,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to compute project worksheet analytics.',
      );
    }
  }
}
