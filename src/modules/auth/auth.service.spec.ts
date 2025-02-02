import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { Users } from '../users/schemas/users.schema';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { Organization } from '../users/schemas/Organization.schema';
import { EmailService } from '../email-service/email-service.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;
  let userModel: any;
  let otpSecretModel: any;
  let organizationModel: any;
  let emailService: any;
  let jwtService: any;
  let configService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(Users.name),
          useValue: { findOne: jest.fn(), create: jest.fn() },
        },
        {
          provide: getModelToken(OTPSecret.name),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getModelToken(Organization.name),
          useValue: { find: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn(), decode: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(Users.name));
    otpSecretModel = module.get(getModelToken(OTPSecret.name));
    organizationModel = module.get(getModelToken(Organization.name));
    emailService = module.get<EmailService>(EmailService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('registerEmailPassword', () => {
    it('should throw ConflictException if user already exists', async () => {
      userModel.findOne.mockResolvedValue(true);
      await expect(
        authService.registerEmailPassword({
          displayName: 'Test User',
          emailAddress: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a user and return tokens', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue({
        toObject: () => ({ id: '123', emailAddress: 'test@example.com' }),
      });
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
      jwtService.sign.mockReturnValue('test-token');
      organizationModel.find.mockResolvedValue([]);

      const result = await authService.registerEmailPassword({
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('test-token');
      expect(result.refreshToken).toBe('test-token');
    });
  });

  describe('loginEmailPassword', () => {
    it('should throw NotfoundException for non existent email', async () => {
      userModel.findOne.mockResolvedValue(null);
      await expect(
        authService.loginEmailPassword({
          emailAddress: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return tokens on successful login', async () => {
      userModel.findOne.mockResolvedValue({
        password: await bcrypt.hash('password123', 10),
        toObject: () => ({ id: '123', emailAddress: 'test@example.com' }),
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jwtService.sign.mockReturnValue('test-token');
      organizationModel.find.mockResolvedValue([]);

      const result = await authService.loginEmailPassword({
        emailAddress: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('test-token');
      expect(result.refreshToken).toBe('test-token');
    });
  });

  describe('verifyToken', () => {
    it('should throw BadRequestException for an invalid token', async () => {
      otpSecretModel.findOne.mockResolvedValue(null);
      await expect(
        authService.verifyToken({ email: 'test@example.com', token: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return isValidated true for valid token', async () => {
      otpSecretModel.findOne.mockResolvedValue({
        secret: '123456',
        updatedAt: new Date(new Date().getTime() - 1000),
      });
      userModel.findOne.mockResolvedValue({ save: jest.fn() });
      const result = await authService.verifyToken({
        email: 'test@example.com',
        token: '123456',
      });
      expect(result.isValidated).toBe(true);
    });
  });

  describe('checkStatus', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);
      await expect(authService.checkStatus('test@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return verified and organization status', async () => {
      userModel.findOne.mockResolvedValue({ isVerified: true, _id: '123' });
      organizationModel.find.mockResolvedValue([]);
      const result = await authService.checkStatus('test@example.com');
      expect(result).toEqual({ verified: true, hasOrganization: false });
    });
  });
});
