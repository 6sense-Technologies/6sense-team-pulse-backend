import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Project } from '../../schemas/Project.schema';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Tool } from '../../schemas/Tool.schema';
import { ProjectTool } from '../../schemas/ProjectTool.schema';
import { Organization } from '../../schemas/Organization.schema';
import { OrganizationProjectUser } from '../../schemas/OrganizationProjectUser.schema';

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
    const organization = await this.Organization.find({
      users: { $in: [userId] },
    });
    if (organization.length === 0) {
      throw new NotFoundException('No organization found for the user');
    }
    const tools = await this.toolModel.insertMany(createProjectDto.tools);
    const projectModel = await this.projectModel.findOneAndUpdate(
      { name: createProjectDto.name }, // Find project by name (or another unique field)
      {
        $set: {
          tools: tools, // Always update tools
        },
        $setOnInsert: {
          name: createProjectDto.name,
          createdBy: new Types.ObjectId(userId),
        },
        $push: { assignedUsers: new Types.ObjectId(userId) }, // Avoid conflict with $setOnInsert
      },
      { new: true, upsert: true }, // `upsert: true` creates if not exists
    );
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

    const orgProjectsUsers = await this.OrganizationProjectUser.find({
      user: new Types.ObjectId(userId),
    });
    // console.log(orgProjectsUsers);
    const projectIds = orgProjectsUsers.map((opu) => opu.project);

    const [result] = await this.projectModel.aggregate([
      {
        $match: {
          _id: { $in: projectIds },
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
        $lookup: {
          from: 'organizationprojectusers', // Reference the OrganizationProjectUser collection
          localField: '_id', // Match project _id with the project field in organizationprojectusers
          foreignField: 'project',
          as: 'projectUsers',
        },
      },
      {
        $addFields: {
          teamSize: { $size: '$projectUsers' }, // Count the number of users per project
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
  async getNames(page: number, limit: number, userId: string) {
    // console.log(organizations);
    const orgProjectsUsers = await this.OrganizationProjectUser.find({
      user: new Types.ObjectId(userId),
    });
    const projectIds = orgProjectsUsers.map((opu) => opu.project);
    const projects = await this.projectModel.find({ _id: projectIds });
    if (!projectIds || projectIds.length === 0) {
      return [];
    }
    console.log(projects);
    // Extract project names
    return projects.map((project) => project['name']);
  }

  async getUserProjectsByOrganization(userId: string, organizationId: string) {
    try {
      // if (!isValidObjectId(userId)) {
      //   throw new BadRequestException('Invalid userId');
      // }
  
      // if (!isValidObjectId(organizationId)) {
      //   throw new BadRequestException('Invalid organizationId');
      // }

      // console.log('User ID:', userId);
      // console.log('Organization ID:', organizationId);
  
      const userObjectId = new Types.ObjectId(userId);
      const orgObjectId = new Types.ObjectId(organizationId);

      // const organization = await this.Organization.findOne({ _id: orgObjectId });
      // if (!organization) {
      //   throw new NotFoundException('Organization not found');
      // }
  
      const projects = await this.OrganizationProjectUser.aggregate([
        {
          $match: {
            user: userObjectId,
            organization: orgObjectId,
          },
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectData',
          },
        },
        {
          $unwind: '$projectData',
        },
        {
          $replaceRoot: { newRoot: '$projectData' },
        },
        {
          $project: {
            _id: 1,
            name: 1,
          },
        },
      ]);
  
      return projects;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve user projects');
    }
  }
  
  

  /* istanbul ignore next */
  findOne(id: string) {
    return this.projectModel.findById(id);
  }
  /* istanbul ignore next */
  update(id: string, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }
  /* istanbul ignore next */
  remove(id: string) {
    return this.projectModel.findByIdAndDelete(id);
  }
}
