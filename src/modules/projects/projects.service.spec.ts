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

describe('ProjectsService - create', () => {
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
    const userId = new Types.ObjectId(); // Generate a valid ObjectId for testing
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
            createdBy: userId, // Pass the valid ObjectId directly
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
            createdBy: userId, // Pass the valid ObjectId directly
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
});
