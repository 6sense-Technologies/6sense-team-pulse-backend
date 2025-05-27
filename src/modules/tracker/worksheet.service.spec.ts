import { Test, TestingModule } from '@nestjs/testing';
import { WorksheetService } from './worksheet.service';
import { getModelToken } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { OrganizationService } from '../organization/organization.service';
import { ActivityService } from './activity.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import * as timeUtils from './time.utils';

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

  const mockActivityService = {
    validateActivitiesForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorksheetService,
        {
          provide: getModelToken(Worksheet.name),
          useValue: mockWorksheetModel,
        },
        {
          provide: getModelToken(WorksheetActivity.name),
          useValue: mockWorksheetActivityModel,
        },
        { provide: getConnectionToken(), useValue: mockConnection },
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
        service.getWorksheetNames(
          userId,
          organizationId,
          projectId,
          name,
          date,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getWorksheets', () => {
    const userId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();

    const mockWorksheetId = new Types.ObjectId();
    const secondWorksheetId = new Types.ObjectId();
    const date = new Date('2025-05-20');

    const activityStart = new Date('2025-05-20T08:00:00Z');
    const activityEnd = new Date('2025-05-20T09:00:00Z');
    const secondActivityStart = new Date('2025-05-20T10:00:00Z');
    const secondActivityEnd = new Date('2025-05-20T11:30:00Z');

    it('should return paginated worksheets with calculated durations', async () => {
      (mockWorksheetModel.aggregate as jest.Mock).mockResolvedValueOnce([
        {
          _id: mockWorksheetId,
          name: 'Worksheet 1',
          date,
          project: { name: 'Project A' },
          worksheetActivities: {},
          activity: {
            startTime: activityStart,
            endTime: activityEnd,
          },
        },
      ]);

      const result = await service.getWorksheets(userId, organizationId, 1, 10);

      expect(mockWorksheetModel.aggregate).toHaveBeenCalled();

      expect(result).toEqual({
        data: [
          {
            worksheetId: mockWorksheetId,
            name: 'Worksheet 1',
            date,
            projectName: 'Project A',
            totalLoggedTime: {
              totalSeconds: 3600,
              hours: 1,
              minutes: 0,
              seconds: 0,
            },
          },
        ],
        paginationMetadata: {
          page: 1,
          limit: 10,
          totalCount: 1,
          totalPages: 1,
        },
      });
    });

    it('should group multiple activities under one worksheet and sum durations', async () => {
      (mockWorksheetModel.aggregate as jest.Mock).mockResolvedValueOnce([
        {
          _id: mockWorksheetId,
          name: 'Worksheet 1',
          date,
          project: { name: 'Project A' },
          worksheetActivities: {},
          activity: {
            startTime: activityStart,
            endTime: activityEnd,
          },
        },
        {
          _id: mockWorksheetId,
          name: 'Worksheet 1',
          date,
          project: { name: 'Project A' },
          worksheetActivities: {},
          activity: {
            startTime: secondActivityStart,
            endTime: secondActivityEnd,
          },
        },
      ]);

      const result = await service.getWorksheets(userId, organizationId);

      expect(result.data[0].totalLoggedTime.totalSeconds).toBe(9000); // 3600 + 5400
      expect(result.data[0].totalLoggedTime.hours).toBe(2);
      expect(result.data[0].totalLoggedTime.minutes).toBe(30);
    });

    it('should return multiple worksheets and paginate correctly', async () => {
      (mockWorksheetModel.aggregate as jest.Mock).mockResolvedValueOnce([
        {
          _id: mockWorksheetId,
          name: 'Worksheet 1',
          date,
          project: { name: 'Project A' },
          worksheetActivities: {},
          activity: {
            startTime: activityStart,
            endTime: activityEnd,
          },
        },
        {
          _id: secondWorksheetId,
          name: 'Worksheet 2',
          date,
          project: { name: 'Project B' },
          worksheetActivities: {},
          activity: {
            startTime: secondActivityStart,
            endTime: secondActivityEnd,
          },
        },
      ]);

      const result = await service.getWorksheets(userId, organizationId, 1, 1);

      expect(result.data.length).toBe(1);
      expect(result.paginationMetadata.totalCount).toBe(2);
      expect(result.paginationMetadata.totalPages).toBe(2);
    });

    it('should throw InternalServerErrorException on aggregation failure', async () => {
      (mockWorksheetModel.aggregate as jest.Mock).mockRejectedValueOnce(
        new Error('Aggregation failed'),
      );

      await expect(
        service.getWorksheets(userId, organizationId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });


  describe('getActivitiesForWorksheet', () => {
    const userId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();
    const worksheetId = new Types.ObjectId().toString();
    const timezoneRegion = 'UTC';
    const page = 1;
    const limit = 10;
    const sortOrder = 'latest';

    const worksheetMock = {
      _id: worksheetId,
      user: new Types.ObjectId(userId),
      organization: new Types.ObjectId(organizationId),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(timeUtils, 'calculateTimeSpent').mockReturnValue({
        hours: 1,
        minutes: 0,
        seconds: 0,
        totalSeconds: 3600,
      });
    });

    it('should return activities with pagination metadata', async () => {
      // Arrange
      mockWorksheetModel.findById.mockResolvedValueOnce(worksheetMock);

      const aggregationResult = [
        {
          data: [
            {
              _id: new Types.ObjectId(),
              name: 'Activity 1',
              startTime: new Date('2025-05-20T08:00:00Z'),
              endTime: new Date('2025-05-20T09:00:00Z'),
              icon: 'icon-url',
            },
          ],
          totalCount: [{ count: 1 }],
        },
      ];

      mockWorksheetActivityModel.aggregate.mockResolvedValueOnce(
        aggregationResult,
      );

      // // Mock calculateTimeSpent if used outside this snippet:
      // jest.mock('./time.utils/calculateTimeSpent', () => ({
      //   calculateTimeSpent: jest.fn(() => ({
      //     hours: 1,
      //     minutes: 0,
      //     seconds: 0,
      //     totalSeconds: 3600,
      //   })),
      // }));

      // Act
      const result = await service.getActivitiesForWorksheet(
        userId,
        organizationId,
        worksheetId,
        timezoneRegion,
        page,
        limit,
        sortOrder,
      );

      expect(mockWorksheetModel.findById).toHaveBeenCalledWith(worksheetId);

      expect(mockWorksheetActivityModel.aggregate).toHaveBeenCalled();

      expect(result).toEqual({
        worksheetId: worksheetMock._id,
        lastReportedOn: worksheetMock.updatedAt,
        data: [
          {
            name: 'Activity 1',
            startTime: new Date('2025-05-20T08:00:00Z'),
            endTime: new Date('2025-05-20T09:00:00Z'),
            icon: 'icon-url',
            timeSpent: {
              hours: 1,
              minutes: 0,
              seconds: 0,
              totalSeconds: 3600,
            },
          },
        ],
        paginationMetadata: {
          page,
          limit,
          totalCount: 1,
          totalPages: 1,
        },
      });
    });

    it('should throw BadRequestException if worksheet not found', async () => {
      mockWorksheetModel.findById.mockResolvedValueOnce(null);

      await expect(
        service.getActivitiesForWorksheet(
          userId,
          organizationId,
          worksheetId,
          timezoneRegion,
          page,
          limit,
          sortOrder,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      mockWorksheetModel.findById.mockResolvedValueOnce(worksheetId);

      // Simulate failure in aggregate
      mockWorksheetActivityModel.aggregate.mockRejectedValueOnce(
        new InternalServerErrorException('Database error'),
      );

      await expect(
        service.getActivitiesForWorksheet(userId, organizationId, worksheetId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('assignActivitiesToWorksheet', () => {
    const userId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();
    const projectId = new Types.ObjectId().toString();
    const date = '2025-05-20';
    const worksheetName = 'My Worksheet';
    const activityIds = [new Types.ObjectId().toString()];

    const assignActivitiesDto = {
      projectId,
      worksheetName,
      activityIds,
      date,
    };

    const worksheet = {
      _id: new Types.ObjectId(),
      name: worksheetName,
    };

    const sessionMock = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();

      mockConnection.startSession.mockReturnValue(sessionMock);
      mockWorksheetModel.findOneAndUpdate.mockResolvedValue(worksheet);
      mockActivityService.validateActivitiesForUser.mockResolvedValue([
        { _id: new Types.ObjectId(activityIds[0]) },
      ]);
      mockWorksheetActivityModel.find.mockResolvedValue([]);
      mockWorksheetActivityModel.insertMany.mockResolvedValue([]);
    });

    it('should assign activities to a worksheet successfully', async () => {
      const result = await service.assignActivitiesToWorksheet(
        userId,
        organizationId,
        assignActivitiesDto,
      );

      expect(mockConnection.startSession).toHaveBeenCalled();
      expect(sessionMock.startTransaction).toHaveBeenCalled();
      expect(mockWorksheetModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockActivityService.validateActivitiesForUser).toHaveBeenCalled();
      expect(mockWorksheetActivityModel.insertMany).toHaveBeenCalled();

      expect(result).toEqual({
        worksheetId: worksheet._id,
        addedActivities: 1,
        skippedActivities: 0,
      });

      expect(sessionMock.commitTransaction).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });

    it('should throw BadRequestException if activities are already linked', async () => {
      mockWorksheetActivityModel.find.mockResolvedValue([
        { activity: new Types.ObjectId(activityIds[0]) },
      ]);

      await expect(
        service.assignActivitiesToWorksheet(
          userId,
          organizationId,
          assignActivitiesDto,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(sessionMock.abortTransaction).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockWorksheetModel.findOneAndUpdate.mockRejectedValue(
        new Error('Unexpected'),
      );

      await expect(
        service.assignActivitiesToWorksheet(
          userId,
          organizationId,
          assignActivitiesDto,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(sessionMock.abortTransaction).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });
  });
});
