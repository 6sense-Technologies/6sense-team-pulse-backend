import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Feedback, FeedbackDocument } from 'src/schemas/feedback.entity';
import { IssueEntry } from 'src/schemas/IssueEntry.schema';
import { OrganizationService } from '../organization/organization.service';
import { IUserWithOrganization } from '../users/interfaces/users.interfaces';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { IFeedbackQuery } from './interface/feedbackList.interface';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    private readonly organizationService: OrganizationService,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
  ) {}

  async create(createFeedbackDto: CreateFeedbackDto, user: IUserWithOrganization) {
    const orgUser = await this.organizationService.validateOrgAccess(
      createFeedbackDto.assignedTo,
      user.organizationId,
    );

    if (!orgUser) {
      throw new NotFoundException('User not found');
    }

    let issuesIds = [];
    if (createFeedbackDto.linkedIssues) {
      issuesIds = createFeedbackDto.linkedIssues.map((issueId) => new Types.ObjectId(issueId));

      const aggregate = [];
      aggregate.push({
        $match: {
          _id: { $in: issuesIds },
          organization: new Types.ObjectId(user.organizationId),
          user: new Types.ObjectId(createFeedbackDto.assignedTo),
        },
      });

      const issues = await this.issueEntryModel.aggregate(aggregate);
      if (issues.length !== createFeedbackDto.linkedIssues.length) {
        throw new NotFoundException('One or more issues not found');
      }
    }

    const feedbackObject = {
      organization: user.organizationId,
      type: createFeedbackDto.type,
      linkedIssues: issuesIds,
      tone: createFeedbackDto.tone,
      comment: createFeedbackDto.comment.trim(),
      assignedTo: createFeedbackDto.assignedTo,
      assignedBy: user.userId,
    };

    return await this.feedbackModel.create(feedbackObject);
  }

  async findAll(user: IUserWithOrganization, query: IFeedbackQuery, metadata: RequestMetadataDto) {
    // let { startDate, endDate } = query;
    // const { timezoneRegion } = metadata;

    // let filterParts: string[] = [];
    // if (query.filter) {
    //   filterParts = query.filter.split(',').map((f: string) => f.trim());
    // }

    const baseMatch: Record<string, any> = {
      organization: new Types.ObjectId(`${user.organizationId}`),
      $or: [
        { assignedTo: new Types.ObjectId(`${user.userId}`) },
        { assignedBy: new Types.ObjectId(`${user.userId}`) },
      ],
    };

    // const types: string[] = [];
    // for (const filter of filterParts) {
    //   if (filter.toLowerCase() === 'us') {
    //     types.push(FeedbackType.USER_STORY);
    //   } else {
    //     types.push(filter);
    //   }
    // }

    // if (types.length > 0) {
    //   baseMatch.type = { $in: types };
    // }

    // const searchMatch: Record<string, any> = {};

    // if (query.search) {
    //   searchMatch.$or = [
    //     { comment: { $regex: query.search, $options: 'i' } },
    //     { 'assignedTo.displayName': { $regex: query.search, $options: 'i' } },
    //     { 'assignedBy.displayName': { $regex: query.search, $options: 'i' } },
    //   ];
    // }

    // if (startDate && endDate) {
    //   startDate = DateTime.fromISO(startDate.toString(), { zone: timezoneRegion })
    //     .startOf('day')
    //     .toJSDate();
    //   endDate = DateTime.fromISO(endDate.toString(), { zone: timezoneRegion })
    //     .endOf('day')
    //     .toJSDate();
    //   baseMatch.createdAt = { $gte: startDate, $lte: endDate };
    // }

    const aggregate = [
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

      // ...(query.search ? [{ $match: searchMatch }] : []),

      {
        $sort: {
          createdAt: query.sortOrder === 'asc' ? 1 : -1,
        },
      },

      {
        $facet: {
          total: [{ $count: 'total' }],
          data: [
            {
              $skip:
                (parseInt(query.page.toString() ?? '1') - 1) *
                parseInt(query.limit.toString() ?? '10'),
            },
            { $limit: parseInt(query.limit.toString() ?? '10') },
          ],
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

    const results = await this.feedbackModel.aggregate(aggregate as PipelineStage[]);
    return results[0] || { data: [], count: 0 };
  }

  // async findOne(id: string, user: IUserWithOrganization) {
  //   const aggregate: PipelineStage[] = [
  //     {
  //       $match: {
  //         _id: new Types.ObjectId(id),
  //         organization: new Types.ObjectId(user.organizationId),
  //         $or: [
  //           { assignedTo: new Types.ObjectId(user.userId) },
  //           { assignedBy: new Types.ObjectId(user.userId) },
  //         ],
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: 'users',
  //         let: { assignedToId: '$assignedTo' },
  //         pipeline: [
  //           { $match: { $expr: { $eq: ['$_id', '$$assignedToId'] } } },
  //           {
  //             $project: {
  //               _id: 1,
  //               displayName: 1,
  //               emailAddress: 1,
  //               avatarUrls: 1,
  //               designation: 1,
  //             },
  //           },
  //         ],
  //         as: 'assignedTo',
  //       },
  //     },
  //     { $unwind: '$assignedTo' },
  //   ];

  //   const feedbacks = await this.feedbackModel.aggregate(aggregate);
  //   if (!feedbacks.length) {
  //     throw new NotFoundException('Feedback not found');
  //   }

  //   return feedbacks[0];
  // }
}
