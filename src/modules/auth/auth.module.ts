import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  Organization,
  OrganizationSchema,
} from '../../schemas/Organization.schema';
import {
  OrganizationProjectUser,
  OrganizationProjectUserSchema,
} from '../../schemas/OrganizationProjectUser.schema';
import {
  OrganizationUserRole,
  OrganizationUserRoleSchema,
} from '../../schemas/OrganizationUserRole.schema';
import { OTPSecret, OTPSecretSchema } from '../../schemas/OTPSecret.schema';
import { Role, RoleSchema } from '../../schemas/Role.schema';
import { Users, UsersSchema } from '../../schemas/users.schema';
import { EmailService } from '../email-service/email-service.service';
import { OrganizationService } from '../organization/organization.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JWTRefreshTokenStrategy } from './strategy/jwt-refresh.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: OTPSecret.name, schema: OTPSecretSchema },
      { name: Organization.name, schema: OrganizationSchema },
      {
        name: OrganizationProjectUser.name,
        schema: OrganizationProjectUserSchema,
      },
      { name: OrganizationUserRole.name, schema: OrganizationUserRoleSchema },
      { name: Role.name, schema: RoleSchema },
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
  exports: [AuthService],
})
export class AuthModule {}
