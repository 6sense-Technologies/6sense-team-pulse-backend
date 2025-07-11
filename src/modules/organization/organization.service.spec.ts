import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationUserRole } from 'src/schemas/OrganizationUserRole.schema';
import { Role } from 'src/schemas/Role.schema';
import { Organization } from '../../schemas/Organization.schema';
import { Users } from '../../schemas/users.schema';
import { OrganizationService } from './organization.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

describe('OrganizationService', () => {
  let service: OrganizationService;

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  const mockConnection = {
    startSession: jest.fn().mockResolvedValue(mockSession),
  };

  const mockOrganizationModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    exists: jest.fn(),
  };

  const mockUsersModel = {
    findOne: jest.fn(),
    exists: jest.fn(),
  };

  const mockRoleModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockOrganizationUserRoleModel = {
    create: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: getModelToken(Organization.name), useValue: mockOrganizationModel },
        { provide: getModelToken(Users.name), useValue: mockUsersModel },
        {
          provide: getModelToken(OrganizationUserRole.name),
          useValue: mockOrganizationUserRoleModel,
        },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should throw ConflictException if domain exists', async () => {
      mockOrganizationModel.findOne.mockResolvedValue(true);
      await expect(
        service.create({ organizationName: 'Test', domainName: 'test.com' }, '1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create organization and role', async () => {
      mockOrganizationModel.findOne.mockResolvedValue(null);
      mockUsersModel.findOne.mockImplementation(() => ({
        session: () => Promise.resolve({ _id: 'mock-user' }),
      }));
      mockOrganizationModel.create.mockResolvedValue([{ _id: 'org1' }]);
      mockRoleModel.findOne.mockImplementation(() => ({
        session: () => Promise.resolve(null),
      }));
      mockRoleModel.create.mockResolvedValue([{ _id: 'role1' }]);

      const result = await service.create(
        { organizationName: 'Test', domainName: 'test.com' },
        '1',
      );
      expect(result).toEqual({ _id: 'org1' });
    });
  });

  describe('findRoles', () => {
    it('should return all roles', async () => {
      mockRoleModel.find.mockResolvedValue([{ roleName: 'admin' }]);
      const roles = await service.findRoles();
      expect(roles).toEqual([{ roleName: 'admin' }]);
    });
  });

  describe('findByUser', () => {
    it('should throw BadRequestException if no user ID', async () => {
      await expect(service.findByUser({} as any)).rejects.toThrow(BadRequestException);
    });

    it('should return organizations for user', async () => {
      mockOrganizationUserRoleModel.aggregate.mockResolvedValue([
        { _id: 'org1', organizationName: 'TestOrg', roleName: 'admin' },
      ]);

      const result = await service.findByUser({
        userId: new Types.ObjectId().toString(),
        organizationId: new Types.ObjectId().toString(),
        email: 'abc@gmail.com',
      });
      const expectedResult = [
        { _id: 'org1', connected: false, organizationName: 'TestOrg', roleName: 'admin' },
      ];
      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if user has no orgs', async () => {
      mockOrganizationUserRoleModel.aggregate.mockResolvedValue([]);
      await expect(
        service.findByUser({
          userId: new Types.ObjectId().toString(),
          organizationId: '',
          email: '',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateOrgAccess', () => {
    it('should throw BadRequestException for invalid IDs', async () => {
      await expect(service.validateOrgAccess('invalid', 'also-invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user/org doesn’t exist', async () => {
      mockOrganizationUserRoleModel.findOne.mockImplementation(() => ({
        populate: jest.fn(),
      }));
      mockUsersModel.exists.mockResolvedValue(false);
      mockOrganizationModel.exists.mockResolvedValue(false);

      await expect(
        service.validateOrgAccess(new Types.ObjectId().toString(), new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not in org', async () => {
      mockOrganizationUserRoleModel.findOne.mockImplementation(() => ({
        populate: jest.fn(),
      }));
      mockUsersModel.exists.mockResolvedValue(true);
      mockOrganizationModel.exists.mockResolvedValue(true);

      await expect(
        service.validateOrgAccess(new Types.ObjectId().toString(), new Types.ObjectId().toString()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return orgUser if access is valid', async () => {
      mockOrganizationUserRoleModel.findOne.mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue({
          role: { roleName: 'admin' },
        }),
      }));

      const result = await service.validateOrgAccess(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      );
      expect(result).toBeDefined();
    });
  });

  // describe('accessLatestOrganization', () => {
  //   it('should return the most recently accessed organization', async () => {
  //     const userId = new Types.ObjectId();  // Create a mock user ObjectId
  //     const organizationId = new Types.ObjectId();  // Create a mock organization ObjectId
      
  //     const mockFindReturnValue = {
  //       sort: jest.fn().mockReturnThis(),
  //       limit: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValue([{ organization: organizationId }]),  // Mock the query result with the organization ObjectId
  //     };

  //     // Mock the find method to return the mock query builder
  //     mockOrganizationUserRoleModel.find.mockReturnValue(mockFindReturnValue);

  //     // Mock updateLastAccessed method
  //     const updateLastAccessedMock = jest.fn();
  //     service.updateLastAccessed = updateLastAccessedMock;

  //     // Run the method under test
  //     await service.accessLatestOrganization(userId);


  //     jest.spyOn(mockOrganizationUserRoleModel, 'find').mockReturnValue(mockFindReturnValue);

  //     // Ensure that updateLastAccessed was called with the correct Mongo IDs
  //     expect(updateLastAccessedMock).toHaveBeenCalledWith(userId, organizationId);
      
  //     // Also, ensure that the correct organization is returned
  //     expect(await service.accessLatestOrganization(userId)).toEqual(organizationId);
  //   });

  //   it('should throw NotFoundException if none found', async () => {
  //     const userId = new Types.ObjectId();  // Create a mock user ObjectId

  //     const mockFindReturnValue = {
  //       sort: jest.fn().mockReturnThis(),
  //       limit: jest.fn().mockReturnThis(),
  //       exec: jest.fn().mockResolvedValueOnce([]),  // Return an empty array (no organizations)
  //     };

  //     mockOrganizationUserRoleModel.find.mockReturnValue(mockFindReturnValue);

  //     // Mock updateLastAccessed method
  //     const updateLastAccessedMock = jest.fn();
  //     service.updateLastAccessed = updateLastAccessedMock;

  //     // Run the method under test and expect an error
  //     await expect(service.accessLatestOrganization(userId)).rejects.toThrow(NotFoundException);

  //     // Ensure updateLastAccessed was not called if no organization is found
  //     expect(updateLastAccessedMock).not.toHaveBeenCalled();
  //   });
  // });


  describe('updateLastAccessed', () => {
    it('should throw BadRequestException if invalid IDs', async () => {
      await expect(service.updateLastAccessed('badid' as any, 'badid' as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user not in org', async () => {
      const save = jest.fn();
      mockOrganizationUserRoleModel.findOne.mockRejectedValueOnce(new NotFoundException('OrganizationUserRole not found'));
      
      await expect(
        service.updateLastAccessed(new Types.ObjectId(), new Types.ObjectId()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update lastAccessed field', async () => {
      const save = jest.fn();
      mockOrganizationUserRoleModel.findOne.mockResolvedValue({
        lastAccessed: null,
        save: jest.fn().mockImplementation(() => save()),
      });

      await service.updateLastAccessed(new Types.ObjectId(), new Types.ObjectId());
      expect(save).toHaveBeenCalled();
    });
  });
});
