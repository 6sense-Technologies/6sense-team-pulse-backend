import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tool } from '../../schemas/Tool.schema';
import { ToolName } from '../../schemas/ToolName.schema';
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

  async getToolById(toolId: string): Promise<Tool> {
    const tool = await this.toolModel.findById(toolId);
    if (!tool) {
      throw new Error('Tool not found');
    }
    return tool;
  }

  async create(toolNameDTO: ToolNameDTO) {
    const toolNameInstance = await this.toolNameModel.create({
      toolName: toolNameDTO.toolName,
    });
    return toolNameInstance;
  }

  async updateToolWithAccessToken(toolId: string, accessToken: string): Promise<Tool> {
    const tool = await this.toolModel.findById(toolId);
    if (!tool) {
      throw new Error('Tool not found');
    }
    tool.accessToken = accessToken;
    return await tool.save();
  }
}
