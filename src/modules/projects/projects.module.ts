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
import { Tool, ToolSchema } from '../users/schemas/Tool.schema';
import {
  ProjectTool,
  ProjectToolSchema,
} from '../users/schemas/ProjectTool.schema';
import { Organization, OrganizationSchema } from '../users/schemas/Organization.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: GitRepo.name, schema: GitRepoSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Tool.name, schema: ToolSchema },
      { name: ProjectTool.name, schema: ProjectToolSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
