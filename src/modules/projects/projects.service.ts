import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { OrganizationProjectUser } from '../../schemas/OrganizationProjectUser.schema';
import { Project } from '../../schemas/Project.schema';
import { Tool } from '../../schemas/Tool.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(Tool.name) private readonly toolModel: Model<Tool>,
    @InjectConnection()
    private readonly connection: Connection,
    @InjectModel(OrganizationProjectUser.name)
    private readonly OrganizationProjectUser: Model<OrganizationProjectUser>,
  ) {}
  private readonly logger = new Logger(ProjectsService.name);

  async create(createProjectDto: CreateProjectDto, userId: string, organizationId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const existing = await this.projectModel.findOne({ name: createProjectDto.name }, null, {
        session,
      });

      if (existing) {
        throw new ConflictException('Project with this name already exists');
      }

      const tools = await this.toolModel.insertMany(createProjectDto.tools, {
        session,
      });

      const project = await this.projectModel.findOneAndUpdate(
        { name: createProjectDto.name },
        {
          $set: {
            tools: tools,
          },
          $setOnInsert: {
            name: createProjectDto.name,
            createdBy: new Types.ObjectId(userId),
          },
        },
        {
          session,
          new: true,
          upsert: true,
        },
      );

      await this.OrganizationProjectUser.create(
        [
          {
            organization: new Types.ObjectId(organizationId),
            project: project._id,
            user: new Types.ObjectId(userId),
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return project;
    } catch (error) {
      await session.abortTransaction();

      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error('Project creation failed', {
        userId,
        organizationId,
        error: error.message,
      });

      throw new InternalServerErrorException('Failed to create project');
    } finally {
      session.endSession();
    }
  }

  async findAll(page: number, limit: number, userId: string, organizationId: string) {
    const skip = (page - 1) * limit;

    const orgProjectsUsers = await this.OrganizationProjectUser.find({
      user: new Types.ObjectId(userId),
      organization: new Types.ObjectId(organizationId),
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
                'tools._id': 1,
                'tools.toolName': 1,
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

  async getNames(userId: string, organizationId: string) {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const orgObjectId = new Types.ObjectId(organizationId);

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
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Failed to retrieve user projects');
    }
  }

  // async getUserProjectsByOrganization(userId: string, organizationId: string) {
  //   try {
  //     const userObjectId = new Types.ObjectId(userId);
  //     const orgObjectId = new Types.ObjectId(organizationId);

  //     const projects = await this.OrganizationProjectUser.aggregate([
  //       {
  //         $match: {
  //           user: userObjectId,
  //           organization: orgObjectId,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: 'projects',
  //           localField: 'project',
  //           foreignField: '_id',
  //           as: 'projectData',
  //         },
  //       },
  //       {
  //         $unwind: '$projectData',
  //       },
  //       {
  //         $replaceRoot: { newRoot: '$projectData' },
  //       },
  //       // {
  //       //   $project: {
  //       //     _id: 1,
  //       //     name: 1,
  //       //   },
  //       // },
  //     ]);

  //     return projects;
  //   } catch (error) {
  //     if (error instanceof BadRequestException) throw error;
  //     if (error instanceof NotFoundException) throw error;
  //     if (error instanceof UnauthorizedException) throw error;
  //     throw new InternalServerErrorException(
  //       'Failed to retrieve user projects',
  //     );
  //   }
  // }

  async findOne(id: string, userId: string, organizationId: string) {
    // Validate the project exists and the user has access to it
    const orgProjectsUsers = await this.OrganizationProjectUser.findOne({
      user: new Types.ObjectId(userId),
      organization: new Types.ObjectId(organizationId),
      project: new Types.ObjectId(id),
    });

    if (!orgProjectsUsers) {
      throw new NotFoundException('Access denied to this project or project not found');
    }

    const [project] = await this.projectModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(id),
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
        $project: {
          _id: 1,
          name: 1,
          tools: 1,
        },
      },
      {
        $addFields: {
          tools: {
            $map: {
              input: '$tools',
              as: 'tool',
              in: {
                $mergeObjects: [
                  '$$tool',
                  {
                    connected: {
                      $cond: [
                        { $eq: ['$$tool.toolName', 'Linear'] }, // check tool type
                        {
                          $cond: [
                            {
                              $or: [
                                { $eq: [{ $type: '$$tool.accessToken' }, 'missing'] },
                                {
                                  $eq: [
                                    { $trim: { input: { $ifNull: ['$$tool.accessToken', ''] } } },
                                    '',
                                  ],
                                },
                              ],
                            },
                            false,
                            true,
                          ],
                        },
                        true, // if not Linear, consider it connected by default
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          'tools._id': 1,
          'tools.toolName': 1,
          'tools.connected': 1,
        },
      },
    ]);

    if (!project || project.length === 0) {
      throw new NotFoundException('Access denied to this project or project not found');
    }

    return project;
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
