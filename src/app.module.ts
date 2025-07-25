import { MailerModule } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DataFetcherModule } from './modules/data-fetcher/data-fetcher.module';
import { EmailServiceModule } from './modules/email-service/email-service.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { GitRepoModule } from './modules/git-repo/git-repo.module';
import { GithubModule } from './modules/github/github.module';
import { GoalsModule } from './modules/goals/goals.module';
import { JiraModule } from './modules/jira/jira.module';
import { LinearModule } from './modules/linear/linear.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { QueueHandlerModule } from './modules/queue-handler/queue-handler.module';
import { ToolModule } from './modules/tool/tool.module';
import { TrackerModule } from './modules/tracker/tracker.module';
import { TrelloModule } from './modules/trello/trello.module';
import { UserModule } from './modules/users/users.module';

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
          // url: configService.get<string>('REDIS_URL'),
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          username: configService.get<string>('REDIS_USERNAME'),
          password: configService.get<string>('REDIS_PASSWORD'),
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          uri: configService.get<string>('MONGODB_URL'),
          connectionFactory: (connection) => {
            connection.set('bufferCommands', false); // Optional: Disable command buffering
            return connection;
          },
          connectTimeoutMS: 1000000,
          socketTimeoutMS: 45000000, // 55 seconds timeout for socket inactivity
        };
      },
      inject: [ConfigService],
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_SERVICE_PORT,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
    }),
    UserModule,
    JiraModule,
    TrelloModule,
    GithubModule,
    GitRepoModule,
    QueueHandlerModule,
    ProjectsModule,
    GoalsModule,
    AuthModule,
    EmailServiceModule,
    OrganizationModule,
    ToolModule,
    DataFetcherModule,
    TrackerModule,
    LinearModule,
    FeedbackModule,
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
