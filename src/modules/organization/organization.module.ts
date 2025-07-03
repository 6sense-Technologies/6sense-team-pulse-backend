import { Global, Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema } from '../../schemas/Organization.schema';
import { Users, UsersSchema } from '../../schemas/users.schema';
import { OrganizationUserRole, OrganizationUserRoleSchema } from '../../schemas/OrganizationUserRole.schema';
import { Role, RoleSchema } from '../../schemas/Role.schema';
import { UserModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Global()
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
  exports: [OrganizationService],
})
export class OrganizationModule {}
