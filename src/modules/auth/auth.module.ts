import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Users, UsersSchema } from '../users/schemas/users.schema';
import { EmailService } from '../email-service/email-service.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { OTPSecret, OTPSecretSchema } from '../users/schemas/OTPSecret.schema';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JWTRefreshTokenStrategy } from './strategy/jwt-refresh.strategy';
import { OrganizationService } from '../organization/organization.service';
import {
  Organization,
  OrganizationSchema,
} from '../users/schemas/Organization.schema';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: OTPSecret.name, schema: OTPSecretSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MongooseModule,
    JwtStrategy,
    JWTRefreshTokenStrategy,
    EmailService,
    OrganizationService,
  ],
})
export class AuthModule {}
