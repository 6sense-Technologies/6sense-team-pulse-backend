import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { JiraModule } from 'src/modules/jira/jira.module';
import { UserService } from './users.service';
import { UserController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => JiraModule),
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService,MongooseModule],
})
export class UserModule {}
