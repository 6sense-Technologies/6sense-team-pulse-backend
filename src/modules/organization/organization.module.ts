import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Organization,
  OrganizationSchema,
} from '../users/schemas/Organization.schema';
import { Users, UsersSchema } from '../users/schemas/users.schema';
import {
  OrganizationUserRole,
  OrganizationUserRoleSchema,
} from '../users/schemas/OrganizationUserRole.schema';
import { Role, RoleSchema } from '../users/schemas/Role.schema';
import { UserModule } from '../users/users.module';
import { AuthService } from '../auth/auth.service';

@Module({
  imports: [
    UserModule,
    MongooseModule.forFeature([
      {
        name: Organization.name,
        schema: OrganizationSchema,
      },
      {
        name: OrganizationUserRole.name,
        schema: OrganizationUserRoleSchema,
      },
      {
        name: Users.name,
        schema: UsersSchema,
      },
      {
        name: Role.name,
        schema: RoleSchema,
      },
    ]),
  ],
  providers: [MongooseModule, OrganizationService],
  controllers: [OrganizationController],
})
export class OrganizationModule {}
