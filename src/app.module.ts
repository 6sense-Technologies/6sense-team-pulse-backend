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

dotenv.config();

@Module({
  imports: [
    // External modules
    SentryModule.forRoot(),  // Optional, if already initialized in instrument.ts
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Database connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URL'), // MongoDB URI from env
      }),
      inject: [ConfigService],
    }),

    // Internal modules
    UserModule,
    JiraModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,  // Global Sentry error filter
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
