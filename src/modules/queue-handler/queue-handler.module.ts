import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { GitConsumer } from './queue.processor';
import { GithubService } from '../github/github.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../schemas/user.schema';
import {
  IssueHistory,
  IssueHistorySchema,
} from '../../schemas/IssueHistory.schems';
import {
  IssueEntry,
  IssueEntrySchema,
} from '../../schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../../schemas/GitRepo.schema';
import {
  GitContribution,
  GitContributionSchema,
} from '../../schemas/GitContribution.schema';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'git',
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: GitRepo.name, schema: GitRepoSchema },
      { name: GitContribution.name, schema: GitContributionSchema },
    ]),
    HttpModule,
  ],
  exports: [BullModule],
  providers: [GitConsumer, GithubService],
})
export class QueueHandlerModule {}
