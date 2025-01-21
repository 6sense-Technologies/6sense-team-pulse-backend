import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { VerifyEmailDto } from './dto/email-service.dto';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Users } from '../users/schemas/users.schema';

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,
    @InjectModel(OTPSecret.name)
    private readonly otpSecretModel: Model<OTPSecret>,

    private readonly mailerService: MailerService,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
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
    const code = await this.generateAndStoreCode(emailAddress);
    const emailTemplate = `Your verification code: ${code}`;
    console.log(`Email template: ${emailTemplate}`);

    const response = await this.mailerService.sendMail({
      from: `6sense Projects ${this.configService.get('EMAIL_SENDER')}`,
      to: emailAddress,
      subject: `Please Verify your account for ${emailAddress}`,
      text: emailTemplate,
    });

    return response;
  }

  // Function to validate the code and check if it's within the 2-minute window
  public async verifyToken(verifyEmailDTO: VerifyEmailDto) {
    // Retrieve the latest entry from the database
    const tokenEntry = await this.otpSecretModel.findOne({
      emailAddress: verifyEmailDTO.email,
    });

    if (!tokenEntry) {
      throw new BadRequestException('Invalid Token');
    }

    // Check if the provided code matches the stored code
    if (tokenEntry.secret !== verifyEmailDTO.token) {
      throw new BadRequestException('Invalid Token');
    }

    // Check if the time difference is within the allowed 2 minutes (120 seconds)
    const currentTime = new Date();
    const timeDifference =
      (currentTime.getTime() - tokenEntry.updatedAt.getTime()) / 1000;
    // console.log(timeDifference);
    if (timeDifference > 120) {
      throw new BadRequestException('Token Expired');
    }
    const user = await this.usersModel.findOne({
      emailAddress: verifyEmailDTO.email,
    });
    user.isVerified = true;
    user.save();
    return { isValidated: true };
  }
}
