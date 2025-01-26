import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email-service.service';
import { getModelToken } from '@nestjs/mongoose';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { Users } from '../users/schemas/users.schema';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { EmailTemplate } from './templates/email-template.template';

describe('EmailService', () => {
  let emailService: EmailService;
  let otpSecretModel: any;
  let usersModel: any;
  let mailerService: any;
  let configService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getModelToken(OTPSecret.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
            get: jest.fn().mockReturnValue('noreply@example.com'),
          },
        },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    otpSecretModel = module.get(getModelToken(OTPSecret.name));
    usersModel = module.get(getModelToken(Users.name));
    mailerService = module.get<MailerService>(MailerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('sendEmail', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      usersModel.findOne.mockResolvedValue(null);
      await expect(emailService.sendEmail('test@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send an email successfully with a verification code', async () => {
      const mockUser = { displayName: 'Test User' };
      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(null);
      otpSecretModel.create.mockResolvedValue({});
      jest.spyOn(emailService as any, 'generateCode').mockReturnValue('123456');
      mailerService.sendMail.mockResolvedValue({ success: true });
      EmailTemplate.userVerificationOTPEmailTemplate = jest
        .fn()
        .mockReturnValue('Mocked Template');

      const result = await emailService.sendEmail('test@example.com');

      expect(result).toEqual({ success: true });
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        from: `6sense Projects noreply@example.com`,
        to: 'test@example.com',
        subject: 'Please Verify your account for test@example.com',
        text: 'Mocked Template',
      });
    });

    it('should update an existing OTPSecret entry with a new code', async () => {
      const mockUser = { displayName: 'Test User' };
      const mockOTPEntry = {
        secret: '654321',
        save: jest.fn(),
      };

      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(mockOTPEntry);
      jest.spyOn(emailService as any, 'generateCode').mockReturnValue('123456');
      mailerService.sendMail.mockResolvedValue({ success: true });

      await emailService.sendEmail('test@example.com');

      expect(mockOTPEntry.secret).toBe('123456');
      expect(mockOTPEntry.save).toHaveBeenCalled();
    });

    it('should create a new OTPSecret entry if none exists', async () => {
      const mockUser = { displayName: 'Test User' };
      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(null);
      otpSecretModel.create.mockResolvedValue({});
      jest.spyOn(emailService as any, 'generateCode').mockReturnValue('123456');
      mailerService.sendMail.mockResolvedValue({ success: true });

      await emailService.sendEmail('test@example.com');

      expect(otpSecretModel.create).toHaveBeenCalledWith({
        emailAddress: 'test@example.com',
        secret: '123456',
        timestamp: expect.any(Date),
      });
    });
  });
});
