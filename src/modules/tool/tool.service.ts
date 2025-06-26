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

  async getLinearToolsWithUsers() {
    return await this.toolModel
      .aggregate([
        {
          $match: {
            toolName: 'Linear',
            accessToken: {
              $exists: true,
              $regex: /.*\S.*/, // matches strings containing at least one non-whitespace character
            },
          },
        },
        {
          $lookup: {
            from: 'projects',
            localField: '_id',
            foreignField: 'tools',
            as: 'projects',
          },
        },
        {
          $unwind: {
            path: '$projects',
          },
        },
        {
          $addFields: {
            projects: '$projects._id',
          },
        },
        {
          $lookup: {
            from: 'organizationprojectusers',
            localField: 'projects',
            foreignField: 'project',
            as: 'opu',
          },
        },
        {
          $addFields: {
            users: '$opu.user',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'users',
            foreignField: '_id',
            as: 'users',
          },
        },
        {
          $project: {
            _id: 1,
            toolName: 1,
            projects: 1,
            accessToken: 1,
            'users._id': 1,
            'users.emailAddress': 1,
          },
        },
      ])
      .exec();
  }
}
