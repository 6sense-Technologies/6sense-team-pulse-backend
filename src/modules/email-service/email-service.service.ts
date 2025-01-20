import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as OTPAuth from 'otpauth';
import { VerifyEmailDto } from './dto/email-service.dto';

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,

    private readonly mailerService: MailerService,
  ) {}
  private async generateToken(emailAddress: string) {
    const totp = new OTPAuth.TOTP({
      issuer: '6senseTechnologies',
      label: emailAddress,
      algorithm: 'SHA1',
      digits: 6,
      period: 120,
      secret: this.configService.get('OTP_PRIVATE_KEY'),
    });
    return totp.generate();
  }
  public async sendEmail(emailAddress: string) {
    const totpCode = await this.generateToken(emailAddress);
    const emailTemplate = `Your verification code: ${totpCode}`;
    console.log(`Email template ${emailTemplate}`);
    const response = await this.mailerService.sendMail({
      from: `6sense Projects ${this.configService.get('EMAIL_SENDER')}`,
      to: emailAddress,
      subject: `Please Verify your account for ${emailAddress}`,
      text: emailTemplate,
    });
    return response;
  }
  public async verifyToken(verifyEmailDTO: VerifyEmailDto) {
    const totp = new OTPAuth.TOTP({
      issuer: '6senseTechnologies',
      label: verifyEmailDTO.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 120,
      secret: this.configService.get('OTP_PRIVATE_KEY'),
    });
    const token = verifyEmailDTO.token;
    const delta = totp.validate({ token, window: 1 });

    let validated: boolean = false;
    if (delta !== null) {
      validated = true;
    }

    return { isValidated: validated };
  }
}
