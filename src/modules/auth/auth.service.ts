import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Users } from '../users/schemas/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import {
  CreateUserEmail,
  CreateUserEmailPasswordDTO,
  LoginUserEmailPasswordDTO,
  VerifyEmailDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email-service/email-service.service';
import { JwtService } from '@nestjs/jwt';
import { OTPSecret } from '../users/schemas/OTPSecret.schema';
import { Organization } from '../users/schemas/Organization.schema';
import { userInfo } from 'os';

@Injectable()
export class AuthService {
  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Users.name) private readonly userModel: Model<Users>,
    @InjectModel(OTPSecret.name)
    private readonly otpSecretModel: Model<OTPSecret>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  private generateTokens(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { userId, email },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE'),
      },
    );
    const refreshToken = this.jwtService.sign(
      { userId, email },
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
      throw new ConflictException('User already exist');
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
    );
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
    });
    // if(!user.isVerified){
    //   throw new BadRequestException('User is not verified')
    // }
    if (user && user.password !== null) {
      const checkPassword = await bcrypt.compare(
        loginUserEmailPasswordDTO.password,
        user.password,
      );
      if (!checkPassword) {
        throw new BadRequestException('Invalid Credentials');
      } else {
        const { accessToken, refreshToken } = this.generateTokens(
          user.id,
          user.emailAddress,
        );
        const userInfo = user.toObject();

        delete userInfo.password;
        const organizations = await this.organizationModel.find({
          createdBy: userInfo._id,
        });
        if (organizations.length > 0) {
          userInfo['hasOrganization'] = true;
        } else {
          userInfo['hasOrganization'] = false;
        }
        return {
          userInfo,
          accessToken: accessToken,
          refreshToken: refreshToken,
        };
      }
    } else {
      throw new BadRequestException('User does not exists');
    }
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
    const tokens = this.generateTokens(decoded.userId, decoded.email);
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
}
