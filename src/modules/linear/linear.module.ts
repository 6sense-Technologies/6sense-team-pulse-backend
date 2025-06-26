import { Module } from '@nestjs/common';
import { LinearService } from './linear.service';
import { LinearController } from './linear.controller';
import { ToolModule } from '../tool/tool.module';
import { MongooseModule } from '@nestjs/mongoose';
import { IssueEntrySchema } from 'src/schemas/IssueEntry.schema';

@Module({
  imports: [ToolModule, MongooseModule.forFeature([{ name: 'IssueEntry', schema: IssueEntrySchema }])],
  controllers: [LinearController],
  providers: [LinearService],
  exports: [LinearService],
})
export class LinearModule {}
