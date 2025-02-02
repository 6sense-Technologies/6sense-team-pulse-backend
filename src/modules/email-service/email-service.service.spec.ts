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

  // Helper function to mock dependencies
  const setupTestingModule = async () => {
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

    return {
      emailService: module.get<EmailService>(EmailService),
      otpSecretModel: module.get(getModelToken(OTPSecret.name)),
      usersModel: module.get(getModelToken(Users.name)),
      mailerService: module.get<MailerService>(MailerService),
      configService: module.get<ConfigService>(ConfigService),
    };
  };

  beforeEach(async () => {
    const dependencies = await setupTestingModule();
    emailService = dependencies.emailService;
    otpSecretModel = dependencies.otpSecretModel;
    usersModel = dependencies.usersModel;
    mailerService = dependencies.mailerService;
    configService = dependencies.configService;
  });

  describe('sendEmail', () => {
    const mockUser = { displayName: 'Test User' };
    const mockEmailAddress = 'test@example.com';
    const mockCode = '123456';

    beforeEach(() => {
      // Mock the generateCode function to return a predictable value
      jest.spyOn(emailService as any, 'generateCode').mockReturnValue(mockCode);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      usersModel.findOne.mockResolvedValue(null);

      await expect(emailService.sendEmail(mockEmailAddress)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send an email successfully with a verification code for a new user', async () => {
      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(null); // No existing OTP entry
      otpSecretModel.create.mockResolvedValue({});
      mailerService.sendMail.mockResolvedValue({ success: true });
      EmailTemplate.userVerificationOTPEmailTemplate = jest
        .fn()
        .mockReturnValue('Mocked Template');

      const result = await emailService.sendEmail(mockEmailAddress);

      expect(result).toEqual({ success: true });
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        from: `6sense Projects noreply@example.com`,
        to: mockEmailAddress,
        subject: `Please Verify your account for ${mockEmailAddress}`,
        text: 'Mocked Template',
      });
      expect(otpSecretModel.create).toHaveBeenCalledWith({
        emailAddress: mockEmailAddress,
        secret: mockCode,
        timestamp: expect.any(Date),
      });
    });

    it('should update an existing OTPSecret entry with a new code', async () => {
      const mockOTPEntry = {
        secret: 'old-code',
        save: jest.fn(),
      };

      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(mockOTPEntry); // Existing OTP entry
      mailerService.sendMail.mockResolvedValue({ success: true });

      await emailService.sendEmail(mockEmailAddress);

      expect(mockOTPEntry.secret).toBe(mockCode);
      expect(mockOTPEntry.save).toHaveBeenCalled();
    });

    it('should create a new OTPSecret entry if none exists', async () => {
      usersModel.findOne.mockResolvedValue(mockUser);
      otpSecretModel.findOne.mockResolvedValue(null); // No existing OTP entry
      otpSecretModel.create.mockResolvedValue({});
      mailerService.sendMail.mockResolvedValue({ success: true });

      await emailService.sendEmail(mockEmailAddress);

      expect(otpSecretModel.create).toHaveBeenCalledWith({
        emailAddress: mockEmailAddress,
        secret: mockCode,
        timestamp: expect.any(Date),
      });
    });
  });
});
