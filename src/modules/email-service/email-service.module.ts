import { Module } from '@nestjs/common';
import { EmailService } from './email-service.service';
import { EmailServiceController } from './email-service.controller';

@Module({
  providers: [EmailService],
  controllers: [EmailServiceController]
})
export class EmailServiceModule {}
