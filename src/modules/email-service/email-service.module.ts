import { Module } from '@nestjs/common';
import { EmailService } from './email-service.service';
import { EmailServiceController } from './email-service.controller';

import { MongooseModule } from '@nestjs/mongoose';

import { UserService } from '../users/users.service';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../users/users.module';
import { OTPSecret, OTPSecretSchema } from '../users/schemas/OTPSecret.schema';
import { Users, UsersSchema } from '../users/schemas/users.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.INVITE_SECRET,
      signOptions: { expiresIn: '60m' },
    }),
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: OTPSecret.name, schema: OTPSecretSchema },
    ]),
  ],
  providers: [MongooseModule, EmailService, AuthModule, UserModule],
  controllers: [EmailServiceController],
})
export class EmailServiceModule {}
