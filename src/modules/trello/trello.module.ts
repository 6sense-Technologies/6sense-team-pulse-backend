import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrelloService } from './trello.service';
import { TrelloController } from './trello.controller';
import { UserModule } from '../user-depreciated/users.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => {
      return UserModule;
    }),
  ],
  providers: [TrelloService],
  controllers: [TrelloController],
  exports: [TrelloService],
})
export class TrelloModule {}
