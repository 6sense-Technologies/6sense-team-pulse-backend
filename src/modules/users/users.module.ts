import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import {
  IssueHistory,
  IssueHistorySchema,
} from './schemas/IssueHistory.schems';
import { JiraModule } from 'src/modules/jira/jira.module';
import { UserService } from './users.service';
import { UserController } from './users.controller';
import { IssueEntry, IssueEntrySchema } from './schemas/IssueEntry.schema';
import { Comment, CommentSchema } from './schemas/Comment.schema';
import { Project, ProjectSchema } from './schemas/Project.schema';
import { TrelloModule } from '../trello/trello.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: IssueHistory.name, schema: IssueHistorySchema },
      { name: IssueEntry.name, schema: IssueEntrySchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Project.name, schema: ProjectSchema },
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
