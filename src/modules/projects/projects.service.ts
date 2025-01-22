import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Project } from '../users/schemas/Project.schema';
import { Model, Types } from 'mongoose';
import { Tool } from '../users/schemas/Tool.schema';
import { ProjectTool } from '../users/schemas/ProjectTool.schema';
import { Organization } from '../users/schemas/Organization.schema';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(Tool.name) private readonly toolModel: Model<Tool>,
    @InjectModel(ProjectTool.name)
    private readonly ProjectTool: Model<ProjectTool>,
    @InjectModel(Organization.name)
    private readonly Organization: Model<Organization>,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    const projectModel = await this.projectModel.create({
      name: createProjectDto.name,
    });
    // const organization = await this.Organization.findOne({
    //   user
    // });
    const organization = await this.Organization.aggregate([
      {
        $match: {
          users: { $in: [new Types.ObjectId(userId)] }
        }
      },
      {
        $project: {
          _id: 1
        }
      }
    ])
    const tools = await this.toolModel.insertMany(createProjectDto.tools);

    projectModel.tools = tools as any;
    projectModel.save();

    return projectModel;
  }

  async findAll() {
    return await this.projectModel.aggregate([
      {
        $lookup: {
          from: 'tools', 
          localField: 'tools', 
          foreignField: '_id', 
          as: 'tools' 
        }
      }
    ]);
  }

  findOne(id: string) {
    return this.projectModel.findById(id);
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }

  remove(id: string) {
    return this.projectModel.findByIdAndDelete(id);
  }
}
