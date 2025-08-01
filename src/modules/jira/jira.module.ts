import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JiraService } from './jira.service';
import { JiraController } from './jira.controller';
import { UserModule } from '../users/users.module';
import { TrelloModule } from '../trello/trello.module';
// import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    // ClientsModule.register([
    //   {
    //     name: 'DATA_FETCHER_SERVICE',
    //     transport: Transport.MQTT,
    //     options: {
    //       url: process.env.MQTT_BROKER_URL,
    //       username: process.env.MQTT_USERNAME,
    //       password: process.env.MQTT_PASSWORD
    //     },
    //   },
    // ]),
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
