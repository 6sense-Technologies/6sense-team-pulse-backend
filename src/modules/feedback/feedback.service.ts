import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IssueEntry } from 'src/schemas/IssueEntry.schema';
import { OrganizationService } from '../organization/organization.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Feedback, FeedbackDocument } from './entities/feedback.entity';

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

  findAll() {
    return `This action returns all feedback`;
  }

  findOne(id: number) {
    return `This action returns a #${id} feedback`;
  }
}
