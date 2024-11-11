import { Module } from '@nestjs/common';
import { GitRepoService } from './git-repo.service';
import { GitRepoController } from './git-repo.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { IssueHistory, IssueHistorySchema } from '../users/schemas/IssueHistory.schems';
import { IssueEntry, IssueEntrySchema } from '../users/schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../users/schemas/GitRepo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: GitRepo.name, schema: GitRepoSchema },
    ])
  ],
  controllers: [GitRepoController],
  providers: [GitRepoService],
})
export class GitRepoModule {}
