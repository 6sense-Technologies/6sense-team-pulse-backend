import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, PipelineStage, Types } from 'mongoose';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Feedback, FeedbackDocument } from 'src/schemas/feedback.entity';
import { IssueEntry } from 'src/schemas/IssueEntry.schema';
import { OrganizationService } from '../organization/organization.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackType } from './enums/feedbackType.enum';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    private readonly organizationService: OrganizationService,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
  ) {}

  async create(createFeedbackDto: CreateFeedbackDto, req: Request) {
    const { userId, organizationId } = {
      userId: req['user'].userId,
      organizationId: req['user'].organizationId,
    };

    const orgUser = await this.organizationService.validateOrgAccess(
      createFeedbackDto.assignedTo,
      organizationId,
    );

    if (!orgUser) {
      throw new NotFoundException('User not found');
    }

    let issuesIds = [];
    if (createFeedbackDto.linkedIssues) {
      issuesIds = createFeedbackDto.linkedIssues.map((issueId) => new Types.ObjectId(issueId));
      const issues = await this.issueEntryModel.find({ _id: { $in: issuesIds } });
      if (issues.length !== createFeedbackDto.linkedIssues.length) {
        throw new NotFoundException('One or more issues not found');
      }
    }

    const feedbackObject = {
      organizationId: organizationId,
      type: createFeedbackDto.type,
      linkedIssues: issuesIds,
      tone: createFeedbackDto.tone,
      comment: createFeedbackDto.comment.trim(),
      assignedTo: createFeedbackDto.assignedTo,
      assignedBy: userId,
    };

    return await this.feedbackModel.create(feedbackObject);
  }

  async findAll(req: Request, metadata: RequestMetadataDto) {
    const { userId, organizationId } = req['user'];
    const page = Number(req['query'].page) || 1;
    const limit = Number(req['query'].limit) || 10;
    const sortOrder = req['query'].sort?.toString() === 'asc' ? 1 : -1;
    const search = req['query'].search?.toString().trim();
    const timezoneRegion = metadata.timezoneRegion;
    let startDate = req['query'].startDate;
    let endDate = req['query'].endDate;

    const rawFilter = req['query'].filter?.toString().trim();
    let filterParts: string[] = [];
    if (rawFilter) {
      filterParts = rawFilter.split(',').map((f: string) => f.trim());
    }

    const baseMatch: Record<string, any> = {
      organizationId: new Types.ObjectId(`${organizationId}`),
      $or: [
        { assignedTo: new Types.ObjectId(`${userId}`) },
        { assignedBy: new Types.ObjectId(`${userId}`) },
      ],
    };

    const types: string[] = [];
    for (const filter of filterParts) {
      if (filter.toLowerCase() === 'us') {
        types.push(FeedbackType.USER_STORY);
      } else {
        types.push(filter);
      }
    }

    if (types.length > 0) {
      baseMatch.type = { $in: types };
    }

    const searchMatch: Record<string, any> = {};

    if (search) {
      searchMatch.$or = [
        { comment: { $regex: search, $options: 'i' } },
        { 'assignedTo.displayName': { $regex: search, $options: 'i' } },
        { 'assignedBy.displayName': { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate && endDate) {
      startDate = DateTime.fromISO(startDate, { zone: timezoneRegion }).startOf('day').toJSDate();
      endDate = DateTime.fromISO(endDate, { zone: timezoneRegion }).endOf('day').toJSDate();
      baseMatch.createdAt = { $gte: startDate, $lte: endDate };
    }

    const aggregate: PipelineStage[] = [
      { $match: baseMatch },

      {
        $lookup: {
          from: 'users',
          let: { assignedToId: '$assignedTo' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assignedToId'] } } },
            {
              $project: {
                _id: 1,
                displayName: 1,
                emailAddress: 1,
                avatarUrls: 1,
                designation: 1,
              },
            },
          ],
          as: 'assignedTo',
        },
      },
      { $unwind: '$assignedTo' },

      {
        $lookup: {
          from: 'users',
          let: { assignedById: '$assignedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assignedById'] } } },
            {
              $project: {
                _id: 1,
                displayName: 1,
                emailAddress: 1,
                avatarUrls: 1,
                designation: 1,
              },
            },
          ],
          as: 'assignedBy',
        },
      },
      { $unwind: '$assignedBy' },

      ...(search ? [{ $match: searchMatch }] : []),

      {
        $sort: {
          createdAt: sortOrder,
        },
      },

      {
        $facet: {
          total: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
      {
        $unwind: '$total',
      },
      {
        $project: {
          _id: 0,
          count: '$total.total',
          data: 1,
        },
      },
    ];

    const results = await this.feedbackModel.aggregate(aggregate);
    return results[0] || { data: [], count: 0 };
  }

  findOne(id: number) {
    return `This action returns a #${id} feedback`;
  }
}
