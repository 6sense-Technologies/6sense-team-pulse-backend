import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './modules/users/users.module';
import { JiraModule } from './modules/jira/jira.module';
import * as dotenv from 'dotenv';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';

dotenv.config();

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URL'),
      }),
      inject: [ConfigService],
    }),
    UserModule,
    JiraModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
