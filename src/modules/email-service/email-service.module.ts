import { Module } from '@nestjs/common';
import { EmailService } from './email-service.service';
import { EmailServiceController } from './email-service.controller';

import { MongooseModule } from '@nestjs/mongoose';

import { UserService } from '../users/users.service';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../users/schemas/users.module';
import { OTPSecret, OTPSecretSchema } from '../users/schemas/OTPSecret.schema';
import { Users, UsersSchema } from '../users/schemas/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: OTPSecret.name, schema: OTPSecretSchema },
    ]),
  ],
  providers: [MongooseModule, EmailService, AuthModule, UserModule],
  controllers: [EmailServiceController],
})
export class EmailServiceModule {}
