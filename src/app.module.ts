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

dotenv.config();

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
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
    TrelloModule
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
