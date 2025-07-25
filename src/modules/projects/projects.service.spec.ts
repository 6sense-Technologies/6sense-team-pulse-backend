import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection, Model, Types } from 'mongoose';
import { Organization } from '../../schemas/Organization.schema';
import { OrganizationProjectUser } from '../../schemas/OrganizationProjectUser.schema';
import { Project } from '../../schemas/Project.schema';
import { ProjectTool } from '../../schemas/ProjectTool.schema';
import { Tool } from '../../schemas/Tool.schema';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

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
          provide: getModelToken(Project.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            aggregate: jest.fn(),
            findById: jest.fn(),
            findByIdAndDelete: jest.fn(),
          },
        },
        {
          provide: getModelToken(Tool.name),
          useValue: {
            insertMany: jest.fn(),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: {
            startSession: jest.fn(),
          } as Partial<Connection>,
        },
        {
          provide: getModelToken(OrganizationProjectUser.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            aggregate: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectModel = module.get<Model<Project>>('ProjectModel');
    toolModel = module.get<Model<Tool>>('ToolModel');
    organizationProjectUserModel = module.get<Model<OrganizationProjectUser>>(
      'OrganizationProjectUserModel',
    );
  });

  // describe('create', () => {
  //   const userId = new Types.ObjectId();
  //   const createProjectDto: CreateProjectDto = {
  //     name: 'Test Project',
  //     tools: [{ name: 'Tool1' } as any, { name: 'Tool2' } as any],
  //   };

  //   it('should throw ConflictException if project with the same name exists', async () => {
  //     jest.spyOn(projectModel, 'findOne').mockResolvedValue({} as Project);

  //     await expect(
  //       service.create(
  //         createProjectDto,
  //         userId.toHexString(),
  //         '670f5cb7fcec534287bf881a',
  //       ),
  //     ).rejects.toThrow(ConflictException);
  //     expect(projectModel.findOne).toHaveBeenCalledWith({
  //       name: createProjectDto.name,
  //     });
  //   });

  //   it('should throw NotFoundException if no organization is found for the user', async () => {
  //     jest.spyOn(projectModel, 'findOne').mockResolvedValue(null);
  //     jest.spyOn(organizationModel, 'aggregate').mockResolvedValue([]);

  //     await expect(
  //       service.create(
  //         createProjectDto,
  //         userId.toHexString(),
  //         '670f5cb7fcec534287bf881a',
  //       ),
  //     ).rejects.toThrow(NotFoundException);
  //     expect(organizationModel.aggregate).toHaveBeenCalledWith([
  //       {
  //         $match: {
  //           createdBy: userId,
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //         },
  //       },
  //     ]);
  //   });

  //   it('should create a project successfully', async () => {
  //     const mockTools = [
  //       { _id: new Types.ObjectId(), name: 'Tool1' },
  //       { _id: new Types.ObjectId(), name: 'Tool2' },
  //     ];
  //     const mockOrganization = { _id: new Types.ObjectId() };
  //     const mockProject = {
  //       _id: new Types.ObjectId(),
  //       name: createProjectDto.name,
  //       tools: mockTools,
  //       createdBy: userId,
  //       assignedUsers: [userId],
  //     };

  //     jest.spyOn(projectModel, 'findOne').mockResolvedValue(null);
  //     jest
  //       .spyOn(organizationModel, 'aggregate')
  //       .mockResolvedValue([mockOrganization]);
  //     jest.spyOn(toolModel, 'insertMany').mockResolvedValue(mockTools as any);
  //     jest.spyOn(projectModel, 'create').mockResolvedValue(mockProject as any);
  //     jest.spyOn(organizationModel, 'updateOne').mockResolvedValue({} as any);
  //     jest
  //       .spyOn(organizationProjectUserModel, 'create')
  //       .mockResolvedValue({} as any);

  //     const result = await service.create(
  //       createProjectDto,
  //       userId.toHexString(),
  //       '670f5cb7fcec534287bf881a',
  //     );

  //     expect(result).toEqual(mockProject);
  //     expect(projectModel.findOne).toHaveBeenCalledWith({
  //       name: createProjectDto.name,
  //     });
  //     expect(organizationModel.aggregate).toHaveBeenCalledWith([
  //       {
  //         $match: {
  //           createdBy: userId,
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //         },
  //       },
  //     ]);
  //     expect(toolModel.insertMany).toHaveBeenCalledWith(createProjectDto.tools);
  //     expect(projectModel.create).toHaveBeenCalledWith({
  //       name: createProjectDto.name,
  //       tools: mockTools,
  //       createdBy: userId,
  //       assignedUsers: [userId],
  //     });
  //     expect(organizationModel.updateOne).toHaveBeenCalledWith(
  //       { _id: mockOrganization._id },
  //       { $push: { projects: mockProject } },
  //     );
  //     expect(organizationProjectUserModel.create).toHaveBeenCalledWith({
  //       organization: mockOrganization._id,
  //       project: mockProject,
  //       user: userId,
  //     });
  //   });
  // });

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

      jest
        .spyOn(organizationProjectUserModel, 'find')
        .mockResolvedValueOnce([{ project: 'project' }] as any);

      jest.spyOn(projectModel, 'aggregate').mockResolvedValue([
        {
          total: 1,
          data: mockProjects,
        },
      ]);

      const result = await service.findAll(1, 10, userId.toHexString(), '670f5cb7fcec534287bf881a');

      expect(result).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        data: mockProjects,
      });
    });

    it('should return empty array if no projects found', async () => {
      const userId = new Types.ObjectId();

      jest
        .spyOn(organizationProjectUserModel, 'find')
        .mockResolvedValueOnce([{ project: 'project' }] as any);

      jest.spyOn(projectModel, 'aggregate').mockResolvedValue([
        {
          total: 0,
          data: [],
        },
      ]);

      const result = await service.findAll(1, 10, userId.toHexString(), '670f5cb7fcec534287bf881a');

      expect(result).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        data: [],
      });
    });
  });

  describe('getNames', () => {
    it('should return project names for the user', async () => {
      const userId = new Types.ObjectId();
      const mockOrganization = {
        projects: [{ name: 'Project 1' }, { name: 'Project 2' }],
      };

      jest
        .spyOn(organizationProjectUserModel, 'aggregate')
        .mockResolvedValue(mockOrganization as any);

      const result = await service.getNames(userId.toHexString(), '670f5cb7fcec534287bf881a');
      expect(result).toEqual(mockOrganization);
    });

    it('should return empty array if no projects found', async () => {
      const userId = new Types.ObjectId();

      jest.spyOn(organizationProjectUserModel, 'aggregate').mockResolvedValueOnce(null);

      const result = await service.getNames(userId.toHexString(), '670f5cb7fcec534287bf881a');
      expect(result).toEqual(null);
    });
  });

  // describe('findOne', () => {
  //   it('should return a project by id', async () => {
  //     const projectId = new Types.ObjectId();
  //     const mockProject = {
  //       _id: projectId,
  //       name: 'Test Project',
  //     };

  //     jest.spyOn(projectModel, 'findById').mockResolvedValue(mockProject);

  //     jest.spyOn(organizationProjectUserModel, 'findOne').mockImplementationOnce(() => {
  //       return {
  //         populate: jest.fn().mockResolvedValue(mockProject),
  //       } as any;
  //     });

  //     await service.findOne(
  //       projectId.toHexString(),
  //       projectId.toHexString(),
  //       '670f5cb7fcec534287bf881a',
  //     );

  //     // expect(result).toEqual(mockProject);
  //     // expect(projectModel.findById).toHaveBeenCalledWith(projectId);
  //   });

  //   it('should return null if project not found', async () => {
  //     const projectId = new Types.ObjectId();

  //     jest.spyOn(projectModel, 'findById').mockResolvedValue(null);

  //     jest.spyOn(organizationProjectUserModel, 'findOne').mockImplementationOnce(() => {
  //       return {
  //         populate: jest.fn().mockResolvedValue(null),
  //       } as any;
  //     });

  //     const result = await service.findOne(
  //       projectId.toHexString(),
  //       projectId.toHexString(),
  //       '670f5cb7fcec534287bf881a',
  //     );

  //     expect(result).toBeNull();
  //   });
  // });

  describe('update', () => {
    it('should update a project', async () => {
      const projectId = new Types.ObjectId();
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated Project',
      };

      const result = await service.update(projectId.toHexString(), updateProjectDto);

      expect(result).toEqual(`This action updates a #${projectId.toHexString()} project`);
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const projectId = new Types.ObjectId();
      const mockProject = {
        _id: projectId,
        name: 'Test Project',
      };

      jest.spyOn(projectModel, 'findByIdAndDelete').mockResolvedValue(mockProject);

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
