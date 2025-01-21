import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
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
import { Project, ProjectSchema } from '../users/schemas/Project.schema';

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
