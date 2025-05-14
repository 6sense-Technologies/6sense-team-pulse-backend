import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email-service.service';
import { getModelToken } from '@nestjs/mongoose';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { Users } from '../users/schemas/users.schema';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { EmailTemplate } from './templates/email-template.template';

describe('EmailService', () => {
  let emailService: EmailService;
  let otpSecretModel: any;
  let usersModel: any;
  let mailerService: any;
  let configService: any;
  let jwtService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getModelToken(OTPSecret.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getModelToken(Users.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    otpSecretModel = module.get(getModelToken(OTPSecret.name));
    usersModel = module.get(getModelToken(Users.name));
    mailerService = module.get<MailerService>(MailerService);
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('sendEmail', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      usersModel.findOne.mockResolvedValue(null);
      await expect(emailService.sendEmail('test@example.com')).rejects.toThrow(NotFoundException);
    });

    it('should send an email with a verification code', async () => {
      usersModel.findOne.mockResolvedValue({ displayName: 'Test User' });
      otpSecretModel.findOne.mockResolvedValue(null);
      otpSecretModel.create.mockResolvedValue({});
      jest.spyOn(EmailTemplate, 'userVerificationOTPEmailTemplate').mockReturnValue('<html>Mock Email</html>');
      mailerService.sendMail.mockResolvedValue({ success: true });

      const response = await emailService.sendEmail('test@example.com');

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: `Please Verify your account for test@example.com`,
        html: '<html>Mock Email</html>',
      });
      expect(response).toEqual({ success: true });
    });
  });

  describe('sendInvitationEmail', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      usersModel.findOne.mockResolvedValue(null);
      await expect(emailService.sendInvitationEmail('test@example.com', 'Admin', 'TestOrg'))
        .rejects.toThrow(NotFoundException);
    });

    it('should send an invitation email', async () => {
      usersModel.findOne.mockResolvedValue({ displayName: 'Test User' });
      configService.get.mockImplementation((key) => {
        if (key === 'INVITE_SECRET') return 'secret';
        if (key === 'INVITE_EXPIRE') return '1d';
        return 'mock-email-sender@example.com';
      });
      jwtService.sign.mockReturnValue('mock-jwt-token');
      jest.spyOn(EmailTemplate, 'invitationEmail').mockReturnValue('<html>Mock Invite Email</html>');
      mailerService.sendMail.mockResolvedValue({ success: true });

      const response = await emailService.sendInvitationEmail('test@example.com', 'Admin', 'TestOrg');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { emailAddress: 'test@example.com' },
        { secret: 'secret', expiresIn: '1d' },
      );
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: `Invitation for test@example.com`,
        html: '<html>Mock Invite Email</html>',
      });
      expect(response).toEqual({ success: true });
    });
  });
});
