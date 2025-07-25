import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../schemas/user.schema';
import { IssueHistory, IssueHistorySchema } from '../../schemas/IssueHistory.schems';
import { IssueEntry, IssueEntrySchema } from '../../schemas/IssueEntry.schema';
import { GitRepo, GitRepoSchema } from '../../schemas/GitRepo.schema';
import { Project, ProjectSchema } from '../../schemas/Project.schema';
import { Tool, ToolSchema } from '../../schemas/Tool.schema';
import { ProjectTool, ProjectToolSchema } from '../../schemas/ProjectTool.schema';
import { Organization, OrganizationSchema } from '../../schemas/Organization.schema';
import {
  OrganizationProjectUser,
  OrganizationProjectUserSchema,
} from '../../schemas/OrganizationProjectUser.schema';
import {
  OrganizationUserRole,
  OrganizationUserRoleSchema,
} from '../../schemas/OrganizationUserRole.schema';
import { JwtService } from '@nestjs/jwt';
import { OrganizationModule } from '../organization/organization.module';
import { TrackerModule } from '../tracker/tracker.module';
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
      {
        name: OrganizationProjectUser.name,
        schema: OrganizationProjectUserSchema,
      },
      {
        name: OrganizationUserRole.name,
        schema: OrganizationUserRoleSchema,
      },
    ]),
    OrganizationModule,
    TrackerModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, JwtService],
})
export class ProjectsModule {}
