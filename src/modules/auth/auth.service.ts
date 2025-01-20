import { ConflictException, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Users } from './schemas/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import { CreateUserDTO, LoginUserEmailPasswordDTO } from './dto/auth.dto';
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

  
  public async register(createUserDTO: CreateUserDTO) {
    const userExist = await this.userModel.findOne({
      emailAddress: createUserDTO.emailAddress,
    });
    if (userExist) {
      throw new ConflictException('User already exist');
    }
    const hashedPassword = await bcrypt.hash(createUserDTO.password, 10);
    let createdUser: any;
    if (createUserDTO.authType === 'password') {
      // console.log(
      //   `Generate Token ${this.generateToken(createUserDTO.emailAddress)}`,
      // );
      createdUser = await this.userModel.create({
        displayName: createUserDTO.displayName,
        emailAddress: createUserDTO.emailAddress,
        password: hashedPassword,
      });
    } else {
      createdUser = await this.userModel.create({
        displayName: createUserDTO.displayName,
        emailAddress: createUserDTO.emailAddress,
        password: null,
      });
    }
    this.emailService.sendEmail(createUserDTO.emailAddress);
    return createdUser;
  }
}
