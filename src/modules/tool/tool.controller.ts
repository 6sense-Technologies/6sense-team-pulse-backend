import { Body, Controller, Get, Post } from '@nestjs/common';
import { ToolService } from './tool.service';
import { ToolName } from '../users/schemas/ToolName.schema';
import { ToolNameDTO } from './dto/tool.dto';

@Controller('tool')
export class ToolController {
  constructor(private readonly toolService: ToolService) {}
  @Get('list')
  async getToolNames() {
    return this.toolService.get();
  }

  @Post('create')
  async createToolName(@Body() toolNameDTO: ToolNameDTO) {
    return this.toolService.create(toolNameDTO);
  }
}
