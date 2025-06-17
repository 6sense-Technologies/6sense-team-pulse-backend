import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Users } from '../../schemas/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import {
  ChooseOrganization,
  CreateUserEmail,
  CreateUserEmailPasswordDTO,
  LoginUserEmailPasswordDTO,
  VerifyEmailDto,
  VerifyInviteDTO,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email-service/email-service.service';
import { JwtService } from '@nestjs/jwt';
import { OTPSecret } from '../../schemas/OTPSecret.schema';
import { Organization } from '../../schemas/Organization.schema';
import { InviteUserDTO } from '../users/dto/invite-user.dto';
import { OrganizationUserRole } from '../../schemas/OrganizationUserRole.schema';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Users.name) private readonly userModel: Model<Users>,
    @InjectModel(OTPSecret.name)
    private readonly otpSecretModel: Model<OTPSecret>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(OrganizationUserRole.name)
    private readonly organizationUserRoleModel: Model<OrganizationUserRole>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly organizationService: OrganizationService,
  ) {}
  private readonly logger = new Logger(AuthService.name);

  private generateTokens(
    userId: string,
    email: string,
    organizationId: string,
  ) {
    const accessToken = this.jwtService.sign(
      { userId, email, organizationId },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE'),
      },
    );
    const refreshToken = this.jwtService.sign(
      { userId, email, organizationId },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE_REFRESH_TOKEN'),
      },
    );
    return { accessToken, refreshToken };
  }

  public async registerEmailPassword(
    createUserEmailPasswordDTO: CreateUserEmailPasswordDTO,
  ) {
    const userExist = await this.userModel.findOne({
      emailAddress: createUserEmailPasswordDTO.emailAddress,
    });

    if (userExist) {
      if ('isInvited' in userExist) {
        if (userExist['isInvited'] === true) {
          // console.log(userExist);
          //for handling invited users
          const hashedPassword = await bcrypt.hash(
            createUserEmailPasswordDTO.password,
            10,
          );
          if ('password' in userExist) {
            console.log(`Passowrd: ${userExist['password']}`);
            if (userExist['password'] !== undefined) {
              throw new ConflictException('User already exist');
            }
          }
          userExist.password = hashedPassword;
          const { accessToken, refreshToken } = this.generateTokens(
            userExist._id as string,
            userExist.emailAddress,
            '', // Fix: organizationId should be passed here if available
          );

          await userExist.save();

          const userExistObject = userExist.toObject();
          delete userExistObject['password'];
          userExistObject['hasOrganization'] = true;
          return {
            userInfo: userExistObject,
            accessToken,
            refreshToken,
          };
        } else {
          throw new ConflictException('User already exist');
        }
      } else {
        throw new ConflictException('User already exist');
      }
    }

    const hashedPassword = await bcrypt.hash(
      createUserEmailPasswordDTO.password,
      10,
    );

    const createdUser = await this.userModel.create({
      displayName: createUserEmailPasswordDTO.displayName,
      emailAddress: createUserEmailPasswordDTO.emailAddress,
      password: hashedPassword,
    });
    const userObject = createdUser.toObject();
    delete userObject.password;
    this.emailService.sendEmail(createUserEmailPasswordDTO.emailAddress);
    const { accessToken, refreshToken } = this.generateTokens(
      userObject._id as string,
      userObject.emailAddress,
      '', // Fix: organizationId should be passed here if available
    );
    //TODO: CURRENTLY IT IS ASSUMED THAT WHOEVER CREATED THE ORG IS ADMIN. NEED TO FIX THIS BY ADDING INFO IN USERORGANIZATIONROLE MODEL
    const organizations = await this.organizationModel.find({
      createdBy: userObject._id,
    });

    console.log(organizations);
    console.log(userObject);
    if (organizations.length > 0) {
      userObject['hasOrganization'] = true;
    } else {
      userObject['hasOrganization'] = false;
    }
    return { userInfo: userObject, accessToken, refreshToken };
  }

  public async registerEmail(createUserEmail: CreateUserEmail) {
    const userExist = await this.userModel.findOne({
      emailAddress: createUserEmail.emailAddress,
    });
    if (userExist) {
      throw new ConflictException('User already exist');
    }
    const createdUser = await this.userModel.create({
      displayName: createUserEmail.displayName,
      emailAddress: createUserEmail.emailAddress,
      password: null,
    });
    return createdUser;
  }

  public async loginEmailPassword(
    loginUserEmailPasswordDTO: LoginUserEmailPasswordDTO,
  ) {
    const user = await this.userModel.findOne({
      emailAddress: loginUserEmailPasswordDTO.emailAddress,
      isDisabled: false,
    });

    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    if (user && user.password !== null) {
      const checkPassword = await bcrypt.compare(
        loginUserEmailPasswordDTO.password,
        user.password,
      );
      if (!checkPassword) {
        throw new BadRequestException('Invalid Credentials');
      } else {
        // Find the last organization accessed by the user
        const lastOrg = await this.organizationService.lastOrganization(
          user._id as Types.ObjectId,
        );

        const { accessToken, refreshToken } = this.generateTokens(
          user.id,
          user.emailAddress,
          lastOrg.toString(),
        );

        const userInfo = user.toObject();

        delete userInfo.password;
        const organizations = await this.organizationModel.find({
          createdBy: userInfo._id,
        });
        if (organizations.length > 0) {
          // Todo need to fix this
          userInfo['hasOrganization'] = true;
          userInfo['role'] = 'admin';
        } else {
          userInfo['hasOrganization'] = false;
          userInfo['role'] = 'member';
        }

        if ('isInvited' in userInfo) {
          if (userInfo['isInvited'] === true) {
            userInfo['hasOrganization'] = true;
          }
        }
        return {
          userInfo,
          accessToken: accessToken,
          refreshToken: refreshToken,
        };
      }
    } else {
      throw new NotFoundException('User does not exists');
    }
  }

  public async chooseOrganization(chooseOrg: ChooseOrganization) {
    console.log(chooseOrg.organizationId);
    const orgnization = await this.organizationModel.findOne({
      _id: new Types.ObjectId(chooseOrg.organizationId),
    });
    if (orgnization) {
      return {
        organizationId: orgnization._id.toString(),
      };
    } else {
      throw new NotFoundException('Organization Not found');
    }
  }

  public async listOrganizations(userId: string) {
    const organizations = await this.organizationModel.find({
      users: { $in: [userId] },
    });

    const orgNames = organizations.map((org) => {
      return { id: org._id.toString(), name: org.organizationName };
    });

    return orgNames;
  }

  public async generateRefreshTokens(refreshToken: string) {
    if (
      !(await this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      }))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const decoded = this.jwtService.decode(refreshToken);
    console.log(decoded);
    const tokens = this.generateTokens(
      decoded.userId,
      decoded.email,
      decoded.organizationId,
    );
    return tokens;
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
    const user = await this.userModel.findOne({
      emailAddress: verifyEmailDTO.email,
    });
    user.isVerified = true;
    user.save();
    return { isValidated: true };
  }

  public async checkStatus(emailAddress: string) {
    const user = await this.userModel.findOne({ emailAddress: emailAddress });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const organizations = await this.organizationModel.find({
      createdBy: user._id,
    });
    if (organizations.length === 0) {
      return {
        verified: user.isVerified,
        hasOrganization: false,
      };
    } else {
      return {
        verified: user.isVerified,
        hasOrganization: true,
      };
    }
  }

  public async verifyInvite(verifyInviteDTO: VerifyInviteDTO) {
    try {
      await this.jwtService.verifyAsync(verifyInviteDTO.jwtToken, {
        secret: this.configService.get('INVITE_SECRET'),
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      throw new UnauthorizedException('Invalid token');
    }

    // If verification fails, decode the token and proceed
    const decoded = this.jwtService.decode(verifyInviteDTO.jwtToken);
    const user = await this.userModel.findOne({
      emailAddress: decoded.emailAddress,
    });
    if (!user.isVerified) {
      user.isVerified = true;
    }
    await user.save();
    return user;
  }
  public async registerInvitedUser(
    loginUserEmailPasswordDTO: LoginUserEmailPasswordDTO,
  ) {
    const user = await this.userModel.findOne({
      emailAddress: loginUserEmailPasswordDTO.emailAddress,
    });

    user.password = loginUserEmailPasswordDTO.password;
    await user.save();
    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.emailAddress,
      '', // Fix: organizationId should be passed here if available
    );
    user['hasOrganization'] = true;
    return {
      user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }
}
