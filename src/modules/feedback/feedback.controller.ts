import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { GetUser } from 'src/common/request-metadata/getUser.decorator';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { IUserWithOrganization } from '../users/interfaces/users.interfaces';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';
import { IFeedbackQuery } from './interface/feedbackList.interface';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Auth(['admin', 'member'])
  @Post()
  create(@Body() createFeedbackDto: CreateFeedbackDto, @Req() req: Request) {
    return this.feedbackService.create(createFeedbackDto, req);
  }

  @Auth(['admin', 'member'])
  @Get()
  findAll(
    @GetUser() user: IUserWithOrganization,
    @Query() query: IFeedbackQuery,
    @RequestMetadata() metadata: RequestMetadataDto,
  ) {
    return this.feedbackService.findAll(user, query, metadata);
  }

  @Auth(['admin', 'member'])
  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: IUserWithOrganization) {
    return this.feedbackService.findOne(id, user);
  }
}
