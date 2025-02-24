import { Controller, Post, Query } from '@nestjs/common';
import { EmailService } from './email-service.service';

@Controller('email-service')
export class EmailServiceController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-verfication-email')
  async sendEmail(@Query('emailAddress') emailAddress: string) {
    return this.emailService.sendEmail(emailAddress);
  }
}
