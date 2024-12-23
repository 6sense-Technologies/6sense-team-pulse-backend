import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: GitRepo.name, schema: GitRepoSchema },
      { name: GitContribution.name, schema: GitContributionSchema },
    ]),
    HttpModule,
  ],
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
