import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EmailService } from './email-service.service';
import { VerifyEmailDto } from './dto/email-service.dto';

@Controller('email-service')
export class EmailServiceController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-verfication-email')
  async sendEmail(@Query('emailAddress') emailAddress: string) {
    return await this.emailService.sendEmail(emailAddress);
  }
}
