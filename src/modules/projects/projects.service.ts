import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Project } from '../users/schemas/Project.schema';
import { Model, Types } from 'mongoose';
import { Tool } from '../users/schemas/Tool.schema';
import { ProjectTool } from '../users/schemas/ProjectTool.schema';
import { Organization } from '../users/schemas/Organization.schema';
import { OrganizationProjectUser } from '../users/schemas/OrganizationProjectUser.schema';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(Tool.name) private readonly toolModel: Model<Tool>,
    @InjectModel(ProjectTool.name)
    private readonly ProjectTool: Model<ProjectTool>,
    @InjectModel(Organization.name)
    private readonly Organization: Model<Organization>,
    @InjectModel(OrganizationProjectUser.name)
    private readonly OrganizationProjectUser: Model<OrganizationProjectUser>,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    const project = await this.projectModel.findOne({
      name: createProjectDto.name,
    });
    if (project) {
      throw new ConflictException('Project with this name already exists');
    }
    const organization = await this.Organization.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(userId),
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ]);
    if (organization.length === 0) {
      throw new NotFoundException('No organization found for the user');
    }
    const tools = await this.toolModel.insertMany(createProjectDto.tools);
    const projectModel = await this.projectModel.create({
      name: createProjectDto.name,
      tools: tools,
      createdBy: new Types.ObjectId(userId),
      assignedUsers: [new Types.ObjectId(userId)],
    });
    await this.Organization.updateOne(
      { _id: organization[0]._id },
      { $push: { projects: projectModel } },
    );
    await this.OrganizationProjectUser.create({
      organization: organization[0]._id,
      project: projectModel,
      user: new Types.ObjectId(userId),
    });
    return projectModel;
  }

  async findAll(page: number, limit: number, userId: string) {
    const skip = (page - 1) * limit;

    const [result] = await this.projectModel.aggregate([
      {
        $match: {
          createdBy: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'tools',
          localField: 'tools',
          foreignField: '_id',
          as: 'tools',
        },
      },
      {
        $addFields: {
          teamSize: { $size: '$assignedUsers' },
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                tools: 1,
                teamSize: 1, // Include teamSize in the results
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          total: { $arrayElemAt: ['$metadata.total', 0] },
          data: 1, // Include paginated results
        },
      },
    ]);

    return {
      total: result?.total || 0,
      page,
      limit,
      data: result?.data || [],
    };
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
