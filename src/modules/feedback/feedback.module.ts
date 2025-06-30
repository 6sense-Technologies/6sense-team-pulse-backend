import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IssueEntry, IssueEntrySchema } from 'src/schemas/IssueEntry.schema';
import { OrganizationModule } from '../organization/organization.module';
import { Feedback, FeedbackSchema } from './entities/feedback.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [
    OrganizationModule,
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
