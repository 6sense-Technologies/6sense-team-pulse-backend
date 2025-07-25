import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../schemas/user.schema';
import { IssueHistory, IssueHistorySchema } from '../../schemas/IssueHistory.schems';
import { IssueEntry, IssueEntrySchema } from '../../schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../../schemas/GitRepo.schema';
import { GitContribution, GitContributionSchema } from '../../schemas/GitContribution.schema';

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
