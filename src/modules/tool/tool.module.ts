import { Module } from '@nestjs/common';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Tool, ToolSchema } from '../users/schemas/Tool.schema';
import { ToolName, ToolNameSchema } from '../users/schemas/ToolName.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tool.name, schema: ToolSchema },
      { name: ToolName.name, schema: ToolNameSchema },
    ]),
  ],
  controllers: [ToolController],
  providers: [ToolService],
})
export class ToolModule {}
