import { Module } from '@nestjs/common';
import { LinearService } from './linear.service';
import { LinearController } from './linear.controller';
import { ToolModule } from '../tool/tool.module';

@Module({
  imports: [ToolModule],
  controllers: [LinearController],
  providers: [LinearService],
})
export class LinearModule {}
