import { Module } from '@nestjs/common';
import { EmailServiceController } from './email-service.controller';
import { EmailService } from './email-service.service';

import { MongooseModule } from '@nestjs/mongoose';

import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { OTPSecret, OTPSecretSchema } from '../users/schemas/OTPSecret.schema';
import { Users, UsersSchema } from '../users/schemas/users.schema';
import { UserModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.INVITE_SECRET,
      signOptions: { expiresIn: '24 hours' },
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
