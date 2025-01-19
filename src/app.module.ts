import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './modules/users/users.module';
import { JiraModule } from './modules/jira/jira.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import * as dotenv from 'dotenv';
import { TrelloModule } from './modules/trello/trello.module';
import { GithubModule } from './modules/github/github.module';
import { GitRepoModule } from './modules/git-repo/git-repo.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueHandlerModule } from './modules/queue-handler/queue-handler.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { GoalsModule } from './modules/goals/goals.module';

dotenv.config();

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
          // host: configService.get<string>('REDIS_HOST'),
          // port: configService.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          uri: configService.get<string>('MONGODB_URL'),
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
    JiraModule,
    TrelloModule,
    GithubModule,
    GitRepoModule,
    QueueHandlerModule,
    ProjectsModule,
    GoalsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
