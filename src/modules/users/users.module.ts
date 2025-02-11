import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import {
  IssueHistory,
  IssueHistorySchema,
} from './schemas/IssueHistory.schems';
import { JiraModule } from '../jira/jira.module';
import { UserService } from './users.service';
import { UserController } from './users.controller';
import { IssueEntry, IssueEntrySchema } from './schemas/IssueEntry.schema';
import { Comment, CommentSchema } from './schemas/Comment.schema';
import { Project, ProjectSchema } from './schemas/Project.schema';
import { TrelloModule } from '../trello/trello.module';
import { UserProject, UserProjectSchema } from './schemas/UserProject.schema';
import {
  Organization,
  OrganizationSchema,
} from './schemas/Organization.schema';
import {
  OrganizationUserRole,
  OrganizationUserRoleSchema,
} from './schemas/OrganizationUserRole.schema';
import { Role, RoleSchema } from './schemas/Role.schema';
import {
  OrganizationProjectUser,
  OrganizationProjectUserSchema,
} from './schemas/OrganizationProjectUser.schema';
import { Users, UsersSchema } from './schemas/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: UserProject.name, schema: UserProjectSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrganizationUserRole.name, schema: OrganizationUserRoleSchema },
      {
        name: OrganizationProjectUser.name,
        schema: OrganizationProjectUserSchema,
      },
      { name: Role.name, schema: RoleSchema },
      { name: Users.name, schema: UsersSchema },
    ]),
    forwardRef(() => {
      return JiraModule;
    }),
    forwardRef(() => {
      return TrelloModule;
    }),
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService, MongooseModule],
})
export class UserModule {}
