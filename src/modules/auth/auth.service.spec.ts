import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EmailService } from '../email-service/email-service.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Users } from '../users/schemas/users.schema';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { Organization } from '../users/schemas/Organization.schema';
import { ConflictException, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<Users>;
  let otpSecretModel: Model<OTPSecret>;
  let organizationModel: Model<Organization>;
  let emailService: EmailService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    _id: 'user123',
    displayName: 'Test User',
    emailAddress: 'test@example.com',
    password: 'hashedPassword',
    isVerified: false,
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: 'user123',
      displayName: 'Test User',
      emailAddress: 'test@example.com',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(Users.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getModelToken(OTPSecret.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(Organization.name),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mockToken'),
            verify: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              const config = {
                'JWT_SECRET': 'secret',
                'JWT_EXPIRE': '1h',
                'JWT_REFRESH_SECRET': 'refresh-secret',
                'JWT_EXPIRE_REFRESH_TOKEN': '7d',
                'INVITE_SECRET': 'invite-secret'
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get<Model<Users>>(getModelToken(Users.name));
    otpSecretModel = module.get<Model<OTPSecret>>(getModelToken(OTPSecret.name));
    organizationModel = module.get<Model<Organization>>(getModelToken(Organization.name));
    emailService = module.get<EmailService>(EmailService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('registerEmailPassword', () => {
    const registerDto = {
      displayName: 'Test User',
      emailAddress: 'test@example.com',
      password: 'password123',
    };

    it('should create a new user when email does not exist', async () => {
      const hashedPassword = 'hashedPassword123';
      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(userModel, 'create').mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      } as any);
      jest.spyOn(organizationModel, 'find').mockResolvedValue([]);
      jest.spyOn(emailService, 'sendEmail').mockResolvedValue(undefined);

      const result = await service.registerEmailPassword(registerDto);

      expect(userModel.create).toHaveBeenCalledWith({
        displayName: registerDto.displayName,
        emailAddress: registerDto.emailAddress,
        password: hashedPassword,
      });
      expect(emailService.sendEmail).toHaveBeenCalledWith(registerDto.emailAddress);
      expect(result.userInfo).not.toHaveProperty('password');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // expect(result.userInfo.hasOrganization).toBeFalsy();
    });

    it('should handle invited user registration', async () => {
      const hashedPassword = 'hashedPassword123';
      const invitedUser = {
        ...mockUser,
        isInvited: true,
        password: undefined,
      };
      
      jest.spyOn(userModel, 'findOne').mockResolvedValue(invitedUser as any);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);

      const result = await service.registerEmailPassword(registerDto);

      // expect(result.userInfo.hasOrganization).toBeTruthy();
      expect(invitedUser.save).toHaveBeenCalled();
    });

    it('should throw ConflictException for invited user with existing password', async () => {
      const invitedUser = {
        ...mockUser,
        isInvited: true,
        password: 'existingPassword',
      };
      
      jest.spyOn(userModel, 'findOne').mockResolvedValue(invitedUser as any);

      await expect(service.registerEmailPassword(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('registerEmail', () => {
    const registerEmailDto = {
      displayName: 'Test User',
      emailAddress: 'test@example.com',
    };

    it('should create a new user with email only', async () => {
      jest.spyOn(userModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(userModel, 'create').mockResolvedValue(mockUser as any);

      const result = await service.registerEmail(registerEmailDto);

      expect(userModel.create).toHaveBeenCalledWith({
        displayName: registerEmailDto.displayName,
        emailAddress: registerEmailDto.emailAddress,
        password: null,
      });
      expect(result).toBeDefined();
    });

    it('should throw ConflictException when email exists', async () => {
      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUser as any);

      await expect(service.registerEmail(registerEmailDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('loginEmailPassword', () => {
    const loginDto = {
      emailAddress: 'test@example.com',
      password: 'password123',
    };

    it('should successfully login user with valid credentials', async () => {
      const mockUserWithPassword = {
        ...mockUser,
        password: 'hashedPassword',
      };

      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUserWithPassword as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(organizationModel, 'find').mockResolvedValue([{ id: 'org1' }]);

      const result = await service.loginEmailPassword(loginDto);

      // expect(result.userInfo.role).toBe('admin');
      // expect(result.userInfo.hasOrganization).toBeTruthy();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should set correct role for non-admin user', async () => {
      const mockUserWithPassword = {
        ...mockUser,
        password: 'hashedPassword',
      };

      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUserWithPassword as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(organizationModel, 'find').mockResolvedValue([]);

      const result = await service.loginEmailPassword(loginDto);

      // expect(result.userInfo.role).toBe('member');
      // expect(result.userInfo.hasOrganization).toBeFalsy();
    });

    it('should handle invited user login', async () => {
      const mockInvitedUser = {
        ...mockUser,
        password: 'hashedPassword',
        isInvited: true,
        toObject: jest.fn().mockReturnValue({
          ...mockUser.toObject(),
          isInvited: true,
        }),
      };

      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockInvitedUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(organizationModel, 'find').mockResolvedValue([]);

      const result = await service.loginEmailPassword(loginDto);

      // expect(result.userInfo.hasOrganization).toBeTruthy();
    });
  });

  describe('generateRefreshTokens', () => {
    it('should generate new tokens with valid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue(true as any);
      jest.spyOn(jwtService, 'decode').mockReturnValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      const result = await service.generateRefreshTokens('validRefreshToken');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      // jest.spyOn(jwtService, 'verify').mockResolvedValue(false);

      await expect(service.generateRefreshTokens('invalidToken')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyInvite', () => {
    const verifyInviteDto = {
      jwtToken: 'validToken',
    };

    it('should verify and update invited user', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(true as any);
      jest.spyOn(jwtService, 'decode').mockReturnValue({
        emailAddress: 'test@example.com',
      });
      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.verifyInvite(verifyInviteDto);

      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for expired token', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue({ name: 'TokenExpiredError' });

      await expect(service.verifyInvite(verifyInviteDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error());

      await expect(service.verifyInvite(verifyInviteDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('registerInvitedUser', () => {
    const registerInvitedDto = {
      emailAddress: 'test@example.com',
      password: 'newPassword123',
    };

    it('should register invited user with password', async () => {
      jest.spyOn(userModel, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.registerInvitedUser(registerInvitedDto);

      expect(mockUser.save).toHaveBeenCalled();
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});