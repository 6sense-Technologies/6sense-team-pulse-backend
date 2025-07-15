import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IPaginationMetadata } from 'src/common/interfaces/pagination.interface';
import { GetUser } from 'src/common/request-metadata/getUser.decorator';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { IUserWithOrganization } from '../users/interfaces/users.interfaces';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';
import { IFeedback } from './interface/feedback.interface';
import { IFeedbackQuery } from './interface/feedbackList.interface';
import { FeedbackListQuery } from './dto/feedback-list.query';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Auth(['admin', 'member'])
  @Post()
  create(
    @Body() createFeedbackDto: CreateFeedbackDto,
    @GetUser() user: IUserWithOrganization,
  ): Promise<IFeedback> {
    return this.feedbackService.create(createFeedbackDto, user);
  }

  @Auth(['admin', 'member'])
  @Get()
  findAll(
    @GetUser() user: IUserWithOrganization,
    @Query() query: FeedbackListQuery,
    @RequestMetadata() metadata: RequestMetadataDto,
  ): Promise<{ data: IFeedback[]; paginationMetadata: IPaginationMetadata }> {
    return this.feedbackService.findAll(user, query, metadata);
  }

  @Auth(['admin', 'member'])
  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: IUserWithOrganization): Promise<IFeedback> {
    return this.feedbackService.findOne(id, user);
  }
}
