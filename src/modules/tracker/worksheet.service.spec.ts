import { Test, TestingModule } from '@nestjs/testing';
import { WorksheetService } from './worksheet.service';
import { getModelToken } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { OrganizationService } from '../organization/organization.service';
import { ActivityService } from './activity.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('WorksheetService', () => {
  let service: WorksheetService;

  const mockWorksheetModel = {
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
  };

  const mockWorksheetActivityModel = {
    aggregate: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
  };

  const mockConnection = {
    startSession: jest.fn().mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  };

  const mockOrganizationService = {
    verifyUserofOrg: jest.fn(),
  };

  const mockActivityService = {
    validateActivitiesForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorksheetService,
        { provide: getModelToken(Worksheet.name), useValue: mockWorksheetModel },
        {
          provide: getModelToken(WorksheetActivity.name),
          useValue: mockWorksheetActivityModel,
        },
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<WorksheetService>(WorksheetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWorksheetNames', () => {
  const userId = new Types.ObjectId().toString();
  const organizationId = new Types.ObjectId().toString();
  const projectId = new Types.ObjectId().toString();
  const name = 'test worksheet';
  const date = '2025-05-20';

  it('should return worksheet summaries successfully', async () => {
      // Arrange: mock aggregate result
      const mockAggregationResult = [
      {
          name: 'test worksheet',
          date,
          lastReportedOn: new Date('2025-05-20T10:00:00Z'),
          totalActivities: 5,
          totalLoggedTime: {
          totalSeconds: 3600,
          hours: 1,
          minutes: 0,
          seconds: 0,
          },
      },
      ];

      // Mock the aggregate method
      (mockWorksheetModel.aggregate as jest.Mock).mockResolvedValueOnce(
      mockAggregationResult,
      );

      // Act
      const result = await service.getWorksheetNames(
      userId,
      organizationId,
      projectId,
      name,
      date,
      );

      // Assert
      expect(mockWorksheetModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
          expect.objectContaining({
          $match: expect.objectContaining({
              user: new Types.ObjectId(userId),
              organization: new Types.ObjectId(organizationId),
              project: new Types.ObjectId(projectId),
              name: { $regex: new RegExp(name, 'i') },
              date,
          }),
          }),
      ]),
      );
      expect(result).toEqual(mockAggregationResult);
  });

  it('should throw InternalServerErrorException on failure', async () => {
      // Arrange: force aggregate to throw
      (mockWorksheetModel.aggregate as jest.Mock).mockRejectedValueOnce(
      new Error('Database failure'),
      );

      // Act & Assert
      await expect(
      service.getWorksheetNames(userId, organizationId, projectId, name, date),
      ).rejects.toThrow(InternalServerErrorException);
  });
  });

  // describe('getActivitiesForWorksheet', () => {
  //   const userId = new Types.ObjectId().toString();
  //   const organizationId = new Types.ObjectId().toString();
  //   const worksheetId = new Types.ObjectId().toString();
  //   const timezoneRegion = 'UTC';
  //   const page = 1;
  //   const limit = 10;
  //   const sortOrder = 'latest';

  //   const worksheetMock = {
  //     _id: worksheetId,
  //     user: new Types.ObjectId(userId),
  //     organization: new Types.ObjectId(organizationId),
  //     updatedAt: new Date(),
  //   };

  //   beforeEach(() => {
  //     jest.clearAllMocks();
  //   });

  //   it('should return activities with pagination metadata', async () => {
  //     // Arrange
  //     mockOrganizationService.verifyUserofOrg.mockResolvedValueOnce(true);
  //     mockWorksheetModel.findById.mockResolvedValueOnce(worksheetMock);

  //     const aggregationResult = [
  //       {
  //         data: [
  //           {
  //             _id: new Types.ObjectId(),
  //             name: 'Activity 1',
  //             startTime: new Date('2025-05-20T08:00:00Z'),
  //             endTime: new Date('2025-05-20T09:00:00Z'),
  //             icon: 'icon-url',
  //           },
  //         ],
  //         totalCount: [{ count: 1 }],
  //       },
  //     ];

  //     mockWorksheetActivityModel.aggregate.mockResolvedValueOnce(aggregationResult);

  //     // Mock calculateTimeSpent if used outside this snippet:
  //     service.calculateTimeSpent = jest
  //       .fn()
  //       .mockReturnValue('1 hour');

  //     // Act
  //     const result = await service.getActivitiesForWorksheet(
  //       userId,
  //       organizationId,
  //       worksheetId,
  //       timezoneRegion,
  //       page,
  //       limit,
  //       sortOrder,
  //     );

  //     // Assert
  //     expect(mockOrganizationService.verifyUserofOrg).toHaveBeenCalledWith(
  //       userId,
  //       organizationId,
  //     );
  //     expect(mockWorksheetModel.findById).toHaveBeenCalledWith(worksheetId);

  //     expect(mockWorksheetActivityModel.aggregate).toHaveBeenCalled();

  //     expect(result).toEqual({
  //       worksheetId: worksheetMock._id,
  //       lastReportedOn: worksheetMock.updatedAt,
  //       data: [
  //         {
  //           name: 'Activity 1',
  //           startTime: new Date('2025-05-20T08:00:00Z'),
  //           endTime: new Date('2025-05-20T09:00:00Z'),
  //           icon: 'icon-url',
  //           timeSpent: '1 hour',
  //         },
  //       ],
  //       paginationMetadata: {
  //         page,
  //         limit,
  //         totalCount: 1,
  //         totalPages: 1,
  //       },
  //     });
  //   });

  //   it('should throw BadRequestException if worksheet not found', async () => {
  //     mockOrganizationService.verifyUserofOrg.mockResolvedValueOnce(true);
  //     mockWorksheetModel.findById.mockResolvedValueOnce(null);

  //     await expect(
  //       service.getActivitiesForWorksheet(
  //         userId,
  //         organizationId,
  //         worksheetId,
  //         timezoneRegion,
  //         page,
  //         limit,
  //         sortOrder,
  //       ),
  //     ).rejects.toThrow(BadRequestException);
  //   });

  //   it('should throw UnauthorizedException if user/org mismatch', async () => {
  //     mockOrganizationService.verifyUserofOrg.mockResolvedValueOnce(true);
  //     mockWorksheetModel.findById.mockResolvedValueOnce({
  //       ...worksheetMock,
  //       user: new Types.ObjectId(), // different user
  //     });

  //     await expect(
  //       service.getActivitiesForWorksheet(
  //         userId,
  //         organizationId,
  //         worksheetId,
  //         timezoneRegion,
  //         page,
  //         limit,
  //         sortOrder,
  //       ),
  //     ).rejects.toThrow(UnauthorizedException);
  //   });

  //   it('should throw InternalServerErrorException on unexpected errors', async () => {
  //     mockOrganizationService.verifyUserofOrg.mockRejectedValueOnce(
  //       new Error('DB failure'),
  //     );

  //     await expect(
  //       service.getActivitiesForWorksheet(
  //         userId,
  //         organizationId,
  //         worksheetId,
  //         timezoneRegion,
  //         page,
  //         limit,
  //         sortOrder,
  //       ),
  //     ).rejects.toThrow(InternalServerErrorException);
  //   });
  // });

  

});
