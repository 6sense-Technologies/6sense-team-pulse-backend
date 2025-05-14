import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OrganizationService } from './organization.service';
import { Organization } from '../../schemas/Organization.schema';
import { Users } from '../../schemas/users.schema';
import { ConflictException } from '@nestjs/common';

const mockOrganizationModel = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockUsersModel = {
  findOne: jest.fn(),
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getModelToken(Organization.name),
          useValue: mockOrganizationModel,
        },
        {
          provide: getModelToken(Users.name),
          useValue: mockUsersModel,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw a ConflictException if domain name already exists', async () => {
      mockOrganizationModel.findOne.mockResolvedValue(true);

      await expect(
        service.create(
          { organizationName: 'TestOrg', domainName: 'test.com' },
          'user@example.com',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create an organization successfully', async () => {
      mockOrganizationModel.findOne.mockResolvedValue(null);
      mockUsersModel.findOne.mockResolvedValue({
        emailAddress: 'user@example.com',
      });
      mockOrganizationModel.create.mockResolvedValue({
        organizationName: 'TestOrg',
        domain: 'test.com',
      });

      const result = await service.create(
        { organizationName: 'TestOrg', domainName: 'test.com' },
        'user@example.com',
      );

      expect(mockOrganizationModel.create).toHaveBeenCalledWith({
        organizationName: 'TestOrg',
        domain: 'test.com',
        users: [{ emailAddress: 'user@example.com' }],
        createdBy: { emailAddress: 'user@example.com' },
      });
      expect(result).toEqual({
        organizationName: 'TestOrg',
        domain: 'test.com',
      });
    });
  });
});
