import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { Model } from 'mongoose';
import { Project } from '../users/schemas/Project.schema';
import { Tool } from '../users/schemas/Tool.schema';
import { ProjectTool } from '../users/schemas/ProjectTool.schema';
import { Organization } from '../users/schemas/Organization.schema';
import { OrganizationProjectUser } from '../users/schemas/OrganizationProjectUser.schema';
import { Types } from 'mongoose';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectModel: Model<Project>;
  let toolModel: Model<Tool>;
  let projectToolModel: Model<ProjectTool>;
  let organizationModel: Model<Organization>;
  let organizationProjectUserModel: Model<OrganizationProjectUser>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: 'ProjectModel',
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            aggregate: jest.fn(),
            findById: jest.fn(),
            findByIdAndDelete: jest.fn(),
          },
        },
        {
          provide: 'ToolModel',
          useValue: {
            insertMany: jest.fn(),
          },
        },
        {
          provide: 'ProjectToolModel',
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: 'OrganizationModel',
          useValue: {
            aggregate: jest.fn(),
            updateOne: jest.fn(),
            findOne: jest.fn().mockReturnThis(), // Return `this` to allow chaining
            populate: jest.fn().mockResolvedValue({}), // Mock `populate` to allow chaining
            lean: jest.fn(),
          },
        },
        {
          provide: 'OrganizationProjectUserModel',
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectModel = module.get<Model<Project>>('ProjectModel');
    toolModel = module.get<Model<Tool>>('ToolModel');
    projectToolModel = module.get<Model<ProjectTool>>('ProjectToolModel');
    organizationModel = module.get<Model<Organization>>('OrganizationModel');
    organizationProjectUserModel = module.get<Model<OrganizationProjectUser>>(
      'OrganizationProjectUserModel',
    );
  });

  describe('create', () => {
    const userId = new Types.ObjectId();
    const createProjectDto: CreateProjectDto = {
      name: 'Test Project',
      tools: [{ name: 'Tool1' } as any, { name: 'Tool2' } as any],
    };

    it('should throw ConflictException if project with the same name exists', async () => {
      jest.spyOn(projectModel, 'findOne').mockResolvedValue({} as Project);

      await expect(
        service.create(createProjectDto, userId.toHexString()),
      ).rejects.toThrow(ConflictException);
      expect(projectModel.findOne).toHaveBeenCalledWith({
        name: createProjectDto.name,
      });
    });

    it('should throw NotFoundException if no organization is found for the user', async () => {
      jest.spyOn(projectModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(organizationModel, 'aggregate').mockResolvedValue([]);

      await expect(
        service.create(createProjectDto, userId.toHexString()),
      ).rejects.toThrow(NotFoundException);
      expect(organizationModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            createdBy: userId,
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ]);
    });

    it('should create a project successfully', async () => {
      const mockTools = [
        { _id: new Types.ObjectId(), name: 'Tool1' },
        { _id: new Types.ObjectId(), name: 'Tool2' },
      ];
      const mockOrganization = { _id: new Types.ObjectId() };
      const mockProject = {
        _id: new Types.ObjectId(),
        name: createProjectDto.name,
        tools: mockTools,
        createdBy: userId,
        assignedUsers: [userId],
      };

      jest.spyOn(projectModel, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(organizationModel, 'aggregate')
        .mockResolvedValue([mockOrganization]);
      jest.spyOn(toolModel, 'insertMany').mockResolvedValue(mockTools as any);
      jest.spyOn(projectModel, 'create').mockResolvedValue(mockProject as any);
      jest.spyOn(organizationModel, 'updateOne').mockResolvedValue({} as any);
      jest
        .spyOn(organizationProjectUserModel, 'create')
        .mockResolvedValue({} as any);

      const result = await service.create(
        createProjectDto,
        userId.toHexString(),
      );

      expect(result).toEqual(mockProject);
      expect(projectModel.findOne).toHaveBeenCalledWith({
        name: createProjectDto.name,
      });
      expect(organizationModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            createdBy: userId,
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ]);
      expect(toolModel.insertMany).toHaveBeenCalledWith(createProjectDto.tools);
      expect(projectModel.create).toHaveBeenCalledWith({
        name: createProjectDto.name,
        tools: mockTools,
        createdBy: userId,
        assignedUsers: [userId],
      });
      expect(organizationModel.updateOne).toHaveBeenCalledWith(
        { _id: mockOrganization._id },
        { $push: { projects: mockProject } },
      );
      expect(organizationProjectUserModel.create).toHaveBeenCalledWith({
        organization: mockOrganization._id,
        project: mockProject,
        user: userId,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated projects with metadata', async () => {
      const userId = new Types.ObjectId();
      const mockProjects = [
        {
          _id: new Types.ObjectId(),
          name: 'Project 1',
          tools: [],
          teamSize: 1,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(projectModel, 'aggregate').mockResolvedValue([
        {
          total: 1,
          data: mockProjects,
        },
      ]);

      const result = await service.findAll(1, 10, userId.toHexString());

      expect(result).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        data: mockProjects,
      });

      expect(projectModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            createdBy: userId,
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
              { $skip: 0 },
              { $limit: 10 },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  tools: 1,
                  teamSize: 1,
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
            data: 1,
          },
        },
      ]);
    });

    it('should return empty array if no projects found', async () => {
      const userId = new Types.ObjectId();

      jest.spyOn(projectModel, 'aggregate').mockResolvedValue([
        {
          total: 0,
          data: [],
        },
      ]);

      const result = await service.findAll(1, 10, userId.toHexString());

      expect(result).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        data: [],
      });
    });
  });

  describe('getNames', () => {
    // it('should return project names for the user', async () => {
    //   const userId = new Types.ObjectId();
    //   const mockOrganization = {
    //     projects: [{ name: 'Project 1' }, { name: 'Project 2' }],
    //   };

    //   jest
    //     .spyOn(organizationModel, 'findOne')
    //     .mockResolvedValue(mockOrganization);

    //   const result = await service.getNames(1, 10, userId.toHexString());

    //   expect(result).toEqual(['Project 1', 'Project 2']);
    //   expect(organizationModel.findOne).toHaveBeenCalledWith({
    //     createdBy: userId,
    //   });
    // });

    // it('should return empty array if no projects found', async () => {
    //   const userId = new Types.ObjectId();

    //   jest.spyOn(organizationModel, 'findOne').mockResolvedValue(null);

    //   const result = await service.getNames(1, 10, userId.toHexString());

    //   expect(result).toEqual([]);
    // });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      const projectId = new Types.ObjectId();
      const mockProject = {
        _id: projectId,
        name: 'Test Project',
      };

      jest.spyOn(projectModel, 'findById').mockResolvedValue(mockProject);

      const result = await service.findOne(projectId.toHexString());

      expect(result).toEqual(mockProject);
      // expect(projectModel.findById).toHaveBeenCalledWith(projectId);
    });

    it('should return null if project not found', async () => {
      const projectId = new Types.ObjectId();

      jest.spyOn(projectModel, 'findById').mockResolvedValue(null);

      const result = await service.findOne(projectId.toHexString());

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const projectId = new Types.ObjectId();
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated Project',
      };

      const result = await service.update(
        projectId.toHexString(),
        updateProjectDto,
      );

      expect(result).toEqual(
        `This action updates a #${projectId.toHexString()} project`,
      );
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const projectId = new Types.ObjectId();
      const mockProject = {
        _id: projectId,
        name: 'Test Project',
      };

      jest
        .spyOn(projectModel, 'findByIdAndDelete')
        .mockResolvedValue(mockProject);

      const result = await service.remove(projectId.toHexString());

      expect(result).toEqual(mockProject);
      // expect(projectModel.findByIdAndDelete).toHaveBeenCalledWith(projectId);
    });

    it('should return null if project not found', async () => {
      const projectId = new Types.ObjectId();

      jest.spyOn(projectModel, 'findByIdAndDelete').mockResolvedValue(null);

      const result = await service.remove(projectId.toHexString());

      expect(result).toBeNull();
    });
  });
});
