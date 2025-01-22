import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Tool } from '../users/schemas/Tool.schema';
import { Model } from 'mongoose';
import { ToolName } from '../users/schemas/ToolName.schema';
import { ToolNameDTO } from './dto/tool.dto';

@Injectable()
export class ToolService {
  constructor(
    @InjectModel(Tool.name) private readonly toolModel: Model<Tool>,
    @InjectModel(ToolName.name) private readonly toolNameModel: Model<ToolName>,
  ) {}
  async get() {
    return await this.toolNameModel.find({});
  }
  async create(toolNameDTO: ToolNameDTO) {
    const toolNameInstance = await this.toolNameModel.create({
      toolName: toolNameDTO.toolName,
    });
    return toolNameInstance;
  }
}
