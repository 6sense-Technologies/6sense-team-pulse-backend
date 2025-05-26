import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Users, UsersSchema } from '../../schemas/users.schema';
import { EmailService } from '../email-service/email-service.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { OTPSecret, OTPSecretSchema } from '../../schemas/OTPSecret.schema';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JWTRefreshTokenStrategy } from './strategy/jwt-refresh.strategy';
import { OrganizationService } from '../organization/organization.service';
import {
  Organization,
  OrganizationSchema,
} from '../../schemas/Organization.schema';
import {
  OrganizationUserRole,
  OrganizationUserRoleSchema,
} from '../../schemas/OrganizationUserRole.schema';
import { Role, RoleSchema } from '../../schemas/Role.schema';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import {
  OrganizationProjectUser,
  OrganizationProjectUserSchema,
} from '../../schemas/OrganizationProjectUser.schema';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: OTPSecret.name, schema: OTPSecretSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrganizationProjectUser.name, schema: OrganizationProjectUserSchema },
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
