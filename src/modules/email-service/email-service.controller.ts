import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EmailService } from './email-service.service';
import { VerifyEmailDto } from './dto/email-service.dto';

@Controller('email-service')
export class EmailServiceController {
    constructor(private readonly emailService:EmailService){}
    
    @Post('verified')
    async verifyEmail(@Body() verifyEmailDTO:VerifyEmailDto){
        return this.emailService.verifyToken(verifyEmailDTO)
    }
    @Post('send-verfication-email')
    async sendEmail(@Query('emailAddress') emailAddress:string){
        return this.emailService.sendEmail(emailAddress)
    }
}
