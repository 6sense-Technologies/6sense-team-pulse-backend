import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { VerifyEmailDto } from './dto/email-service.dto';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Users } from '../users/schemas/users.schema';
import { EmailTemplate } from './templates/email-template.template';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,
    @InjectModel(OTPSecret.name)
    private readonly otpSecretModel: Model<OTPSecret>,

    private readonly mailerService: MailerService,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
    private readonly jwtService: JwtService,
  ) {}

  // Function to generate a 6-digit code
  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateAndStoreCode(emailAddress: string) {
    const code = this.generateCode();
    const currentTime = new Date();

    // Check if an entry for the email already exists
    const existingEntry = await this.otpSecretModel.findOne({ emailAddress });

    if (existingEntry) {
      // Update the code and timestamp if an entry exists
      existingEntry.secret = code;
      await existingEntry.save();
    } else {
      // Create a new entry if none exists
      await this.otpSecretModel.create({
        emailAddress: emailAddress,
        secret: code,
        timestamp: currentTime,
      });
    }

    return code;
  }

  // Function to send the email with the 6-digit code
  public async sendEmail(emailAddress: string) {
    const user = await this.usersModel.findOne({ emailAddress: emailAddress });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const code = await this.generateAndStoreCode(emailAddress);
    const emailTemplate = EmailTemplate.userVerificationOTPEmailTemplate(
      user.displayName,
      code,
    );
    console.log(`${emailAddress}  Verification code: ${code}`);

    const response = await this.mailerService.sendMail({
      from: `6sense Projects ${this.configService.get('EMAIL_SENDER')}`,
      to: emailAddress,
      subject: `Please Verify your account for ${emailAddress}`,
      html: emailTemplate, //updated to for gmail
    });

    return response;
  }

  public async sendInvitationEmail(userId: string, emailAddress: string) {
    const user = await this.usersModel.findOne({ emailAddress: emailAddress });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const jwtToken = this.jwtService.sign(
      { userId: userId, emailAddress: emailAddress },
      {
        secret: this.configService.get('INVITE_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE'),
      },
    );
    // const response = await this.mailerService.sendMail({
    //   from: `6sense Projects ${this.configService.get('EMAIL_SENDER')}`,
    //   to: emailAddress,
    //   subject: `Please Verify your account for ${emailAddress}`,
    //   html: emailTemplate,//updated to for gmail
    // });

    // return response;
    return 'Done';
  }
}
