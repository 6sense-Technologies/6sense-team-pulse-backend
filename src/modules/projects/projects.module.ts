import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user-depreciated/schemas/user.schema';
import {
  IssueHistory,
  IssueHistorySchema,
} from '../user-depreciated/schemas/IssueHistory.schems';
import {
  IssueEntry,
  IssueEntrySchema,
} from '../user-depreciated/schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../user-depreciated/schemas/GitRepo.schema';
import { Project, ProjectSchema } from '../user-depreciated/schemas/Project.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: GitRepo.name, schema: GitRepoSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
