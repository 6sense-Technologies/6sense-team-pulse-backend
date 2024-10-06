import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JiraService } from './jira.service';
import { JiraController } from './jira.controller';
import { UserModule } from '../users/users.module';
import { TrelloModule } from '../trello/trello.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => {
      return UserModule;
    }),
    TrelloModule,
  ],
  providers: [JiraService],
  controllers: [JiraController],
  exports: [JiraService],
})
export class JiraModule {}
