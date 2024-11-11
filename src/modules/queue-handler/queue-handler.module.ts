import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { GitConsumer } from './queue.processor';
import { GithubService } from '../github/github.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  IssueHistory,
  IssueHistorySchema,
} from '../users/schemas/IssueHistory.schems';
import {
  IssueEntry,
  IssueEntrySchema,
} from '../users/schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../users/schemas/GitRepo.schema';
import { GitContribution, GitContributionSchema } from '../users/schemas/GitContribution.schema';

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
