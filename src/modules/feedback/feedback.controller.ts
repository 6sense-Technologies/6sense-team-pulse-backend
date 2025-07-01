import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

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
  findAll(@Req() req: Request, @RequestMetadata() metadata: RequestMetadataDto) {
    return this.feedbackService.findAll(req, metadata);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.feedbackService.findOne(+id);
  }
}
