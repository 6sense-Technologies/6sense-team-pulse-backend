import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Users } from './schemas/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import {
  CreateUserEmail,
  CreateUserEmailPasswordDTO,
  LoginUserEmailPasswordDTO,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email-service/email-service.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Users.name) private readonly userModel: Model<Users>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  private generateTokens(userId: string, email: string) {
    const access_token = this.jwtService.sign(
      { userId, email },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE'),
      },
    );
    const refresh_token = this.jwtService.sign(
      { userId, email },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRE_REFRESH_TOKEN'),
      },
    );
    return { access_token, refresh_token };
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

    this.emailService.sendEmail(createUserEmailPasswordDTO.emailAddress);
    return createdUser;
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

    if (user && user.password !== null) {
      const checkPassword = await bcrypt.compare(
        loginUserEmailPasswordDTO.password,
        user.password,
      );
      if (!checkPassword) {
        throw new BadRequestException('Invalid Credentials');
      } else {
        const { access_token, refresh_token } = this.generateTokens(
          user.id,
          user.emailAddress,
        );
        const userInfo = user.toObject();
        delete userInfo.password;
        return {
          userInfo,
          access_token: access_token,
          refresh_token: refresh_token,
        };
      }
    } else {
      throw new BadRequestException('Invalid Credentials');
    }
  }
}
