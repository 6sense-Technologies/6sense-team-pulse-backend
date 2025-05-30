import { Test, TestingModule } from '@nestjs/testing';
import { WorksheetService } from './worksheet.service';
import { getModelToken } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { ActivityService } from './activity.service';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';

describe('WorksheetService', () => {
  let service: WorksheetService;

  const mockWorksheetModel = {
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockWorksheetActivityModel = {
    aggregate: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
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
      mockWorksheetModel.aggregate.mockResolvedValueOnce(mockAggregationResult);

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
      (mockWorksheetModel.aggregate).mockRejectedValueOnce(
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

    const worksheetId = new Types.ObjectId();
    const dateStr = '2025-05-21';
    const projectName = 'Test Project';

    const mockActivity = {
      startTime: new Date('2025-05-21T08:00:00Z'),
      endTime: new Date('2025-05-21T09:30:00Z'),
    };

    const mockAggregationResult = [
      {
        _id: worksheetId,
        name: 'Worksheet 1',
        date: dateStr,
        project: { name: projectName },
        worksheetActivities: {},
        activity: mockActivity,
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return worksheet data with calculated time and pagination', async () => {
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(
        mockAggregationResult,
      );

      const result = await service.getWorksheets(userId, organizationId, 1, 10);

      expect(mockWorksheetModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: expect.any(Object) }),
          expect.objectContaining({ $lookup: expect.any(Object) }),
          expect.objectContaining({ $sort: { date: -1 } }),
        ]),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        worksheetId,
        name: 'Worksheet 1',
        date: '21-05-2025',
        projectName,
        totalLoggedTime: {
          totalSeconds: 5400, // 1.5 hours
          hours: 1,
          minutes: 30,
          seconds: 0,
        },
      });

      expect(result.paginationMetadata).toMatchObject({
        page: 1,
        limit: 10,
        totalCount: 1,
        totalPages: 1,
      });
    });

    it('should handle empty activity and return zero time', async () => {
      const noActivityResult = [
        {
          ...mockAggregationResult[0],
          activity: null,
        },
      ];
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(noActivityResult);

      const result = await service.getWorksheets(userId, organizationId);

      expect(result.data[0].totalLoggedTime.totalSeconds).toBe(0);
    });

    it('should paginate correctly with multiple results', async () => {
      const manyResults = Array.from({ length: 15 }, (_, i) => ({
        ...mockAggregationResult[0],
        _id: new Types.ObjectId(),
        name: `Worksheet ${i + 1}`,
        date: '2025-05-21',
      }));

      (mockWorksheetModel.aggregate).mockResolvedValueOnce(manyResults);

      const result = await service.getWorksheets(userId, organizationId, 2, 10);

      expect(result.data).toHaveLength(5); // page 2 of 10 items/page = 5 remaining
      expect(result.paginationMetadata).toMatchObject({
        page: 2,
        limit: 10,
        totalCount: 15,
        totalPages: 2,
      });
    });

    it('should use correct sort order when "oldest" is specified', async () => {
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(mockAggregationResult);

      await service.getWorksheets(userId, organizationId, 1, 10, 'oldest');

      expect(mockWorksheetModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $sort: { date: 1 } }),
        ]),
      );
    });

    it('should apply date filters when startDate and endDate are provided', async () => {
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(mockAggregationResult);

      const startDate = '2025-01-01';
      const endDate = '2025-12-31';

      await service.getWorksheets(userId, organizationId, 1, 10, 'latest', startDate, endDate);

      const calledArgs = (mockWorksheetModel.aggregate).mock.calls[0][0];
      const matchStage = calledArgs.find((s: any) => s.$match)?.$match;

      expect(matchStage.date).toMatchObject({
        $gte: startDate,
        $lte: endDate,
      });
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      (mockWorksheetModel.aggregate).mockRejectedValueOnce(
        new Error('Mongo failure'),
      );

      await expect(
        service.getWorksheets(userId, organizationId),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should re-throw known HTTP exceptions (BadRequest)', async () => {
      const badRequest = new BadRequestException('Invalid ID');
      (mockWorksheetModel.aggregate).mockRejectedValueOnce(badRequest);

      await expect(service.getWorksheets(userId, organizationId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should re-throw known HTTP exceptions (Unauthorized)', async () => {
      const unauthorized = new UnauthorizedException('Not allowed');
      (mockWorksheetModel.aggregate).mockRejectedValueOnce(unauthorized);

      await expect(service.getWorksheets(userId, organizationId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProjectMemberWorksheets', () => {
    const projectId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId();
    const worksheetId = new Types.ObjectId();
    const date = new Date('2025-05-20');
    const createdAt = new Date('2025-05-19T08:00:00Z');

    const sampleActivity = {
      startTime: new Date('2025-05-20T08:00:00Z'),
      endTime: new Date('2025-05-20T09:00:00Z'),
      manualType: 'manual',
    };

    const mockAggregationResult = [
      {
        _id: worksheetId,
        name: 'Worksheet 1',
        date,
        createdAt,
        project: { name: 'Project X' },
        worksheetActivities: {},
        activity: sampleActivity,
        user: {
          _id: userId,
          displayName: 'Test User',
          avatarUrls: { small: 'small.jpg' },
        },
      },
    ];

    beforeEach(() => {
      (mockWorksheetModel.aggregate).mockReset();
    });

    it('should return worksheets with calculated total time and pagination', async () => {
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(
        mockAggregationResult,
      );

      const result = await service.getProjectMemberWorksheets(
        projectId,
        organizationId,
        1,
        10,
      );

      expect(mockWorksheetModel.aggregate).toHaveBeenCalled();

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        worksheetId,
        name: 'Worksheet 1',
        date,
        createdAt,
        projectName: 'Project X',
        containsManualActivity: true,
        totalActivities: 1,
        totalLoggedTime: {
          totalSeconds: 3600,
          hours: 1,
          minutes: 0,
          seconds: 0,
        },
        user: {
          _id: userId,
          displayName: 'Test User',
          avatarUrls: { small: 'small.jpg' },
        },
      });

      expect(result.paginationMetadata).toMatchObject({
        page: 1,
        limit: 10,
        totalCount: 1,
        totalPages: 1,
      });
    });

    it('should sort by duration in ascending order', async () => {
      const extendedResult = [
        ...mockAggregationResult,
        {
          ...mockAggregationResult[0],
          _id: new Types.ObjectId(),
          activity: {
            startTime: new Date('2025-05-20T08:00:00Z'),
            endTime: new Date('2025-05-20T08:10:00Z'), // 600s
          },
        },
      ];

      (mockWorksheetModel.aggregate).mockResolvedValueOnce(
        extendedResult,
      );

      const result = await service.getProjectMemberWorksheets(
        projectId,
        organizationId,
        1,
        10,
        'duration',
        'oldest',
      );

      expect(result.data[0].totalLoggedTime.totalSeconds).toBeLessThan(
        result.data[1].totalLoggedTime.totalSeconds,
      );
    });

    it('should handle search filter correctly', async () => {
      (mockWorksheetModel.aggregate).mockResolvedValueOnce(
        mockAggregationResult,
      );

      const result = await service.getProjectMemberWorksheets(
        projectId,
        organizationId,
        1,
        10,
        'reportedTime',
        'latest',
        undefined,
        undefined,
        'Worksheet',
      );

      expect(mockWorksheetModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              name: { $regex: 'Worksheet', $options: 'i' },
            }),
          }),
        ]),
      );

      expect(result.data).toHaveLength(1);
    });

    it('should throw InternalServerErrorException on aggregation failure', async () => {
      (mockWorksheetModel.aggregate).mockRejectedValueOnce(
        new Error('Aggregation failed'),
      );

      await expect(
        service.getProjectMemberWorksheets(projectId, organizationId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getActivitiesForWorksheet', () => {
    const requesterId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();
    const worksheetId = new Types.ObjectId().toString();
    const projectId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    const worksheetDoc = {
      _id: worksheetId,
      name: 'Worksheet A',
      project: { _id: projectId, name: 'Project X' },
      organization: organizationId,
      lastReportedOn: new Date(),
      user: {
        _id: userId,
        displayName: 'John Doe',
        avatarUrls: { small: 'url' },
      },
    };

    const activityId = new Types.ObjectId();
    const baseActivity = {
      _id: activityId,
      name: 'Activity A',
      startTime: new Date('2025-05-21T08:00:00Z'),
      endTime: new Date('2025-05-21T09:00:00Z'),
      manualType: 'auto',
      icon: 'icon-url',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return worksheet activities for owner', async () => {
      // Setup
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...worksheetDoc, user: { ...worksheetDoc.user, _id: requesterId } }),
      };

      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      mockWorksheetActivityModel.aggregate = jest.fn().mockResolvedValue([
        {
          data: [baseActivity],
          totalCount: [{ count: 1 }],
          totalTime: [{ totalSeconds: 3600 }],
        },
      ]);

      const result = await service.getActivitiesForWorksheet(
        requesterId,
        organizationId,
        worksheetId,
      );

      expect(result.worksheetId).toBe(worksheetId);
      expect(result.reportedBy.name).toBe('John Doe');
      expect(result.data).toHaveLength(1);
      expect(result.totalLoggedTime.totalSeconds).toBe(3600);
    });

    it('should allow admin with project membership', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...worksheetDoc }),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      mockWorksheetModel.aggregate = jest.fn().mockResolvedValue([{ _id: worksheetId }]);

      mockWorksheetActivityModel.aggregate = jest.fn().mockResolvedValue([
        {
          data: [baseActivity],
          totalCount: [{ count: 1 }],
          totalTime: [{ totalSeconds: 3600 }],
        },
      ]);

      const result = await service.getActivitiesForWorksheet(
        requesterId,
        organizationId,
        worksheetId,
        1,
        10,
        'latest',
        '',
        true,
      );

      expect(result.data).toHaveLength(1);
    });

    it('should deny admin without project membership', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...worksheetDoc }),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      mockWorksheetModel.aggregate = jest.fn().mockResolvedValue([]);

      await expect(
        service.getActivitiesForWorksheet(
          requesterId,
          organizationId,
          worksheetId,
          1,
          10,
          'latest',
          '',
          true,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should apply search filter', async () => {
      const searchTerm = 'Activity A';
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...worksheetDoc, user: { ...worksheetDoc.user, _id: requesterId } }),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      mockWorksheetActivityModel.aggregate = jest.fn().mockResolvedValue([
        {
          data: [baseActivity],
          totalCount: [{ count: 1 }],
          totalTime: [{ totalSeconds: 3600 }],
        },
      ]);

      const result = await service.getActivitiesForWorksheet(
        requesterId,
        organizationId,
        worksheetId,
        1,
        10,
        'latest',
        searchTerm,
      );

      const calledAggregation = mockWorksheetActivityModel.aggregate.mock.calls[0][0];
      expect(calledAggregation.find(s => s.$match && s.$match['activity.name'])).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should return empty data if no activities found', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...worksheetDoc, user: { ...worksheetDoc.user, _id: requesterId } }),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      mockWorksheetActivityModel.aggregate = jest.fn().mockResolvedValue([
        {
          data: [],
          totalCount: [],
          totalTime: [],
        },
      ]);

      const result = await service.getActivitiesForWorksheet(
        requesterId,
        organizationId,
        worksheetId,
      );

      expect(result.data).toEqual([]);
      expect(result.totalLoggedTime.totalSeconds).toBe(0);
      expect(result.paginationMetadata.totalCount).toBe(0);
    });

    it('should throw for missing worksheet', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      await expect(
        service.getActivitiesForWorksheet(
          requesterId,
          organizationId,
          worksheetId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for org mismatch', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          ...worksheetDoc,
          organization: new Types.ObjectId().toString(), // different org
        }),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      await expect(
        service.getActivitiesForWorksheet(
          requesterId,
          organizationId,
          worksheetId,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Unexpected')),
      };
      mockWorksheetModel.findById = jest.fn().mockReturnValue(mockPopulateChain);

      await expect(
        service.getActivitiesForWorksheet(
          requesterId,
          organizationId,
          worksheetId,
        ),
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

  describe('removeActivitiesFromWorksheet', () => {
    const userId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();
    const worksheetId = new Types.ObjectId().toString();
    const activityIds = [
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    ];
    const activityObjectIds = activityIds.map((id) => new Types.ObjectId(id));

    let sessionMock;

    beforeEach(() => {
      sessionMock = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };

      mockConnection.startSession = jest.fn().mockReturnValue(sessionMock);
    });

    it('should remove activities and return summary if successful', async () => {
      const mockWorksheet = {
        _id: new Types.ObjectId(),
        user: userId,
        organization: organizationId,
      };

      const mockDeleteResult = { deletedCount: 2 };

      mockWorksheetModel.findById = jest.fn().mockResolvedValue(mockWorksheet);

      mockWorksheetActivityModel.find = jest.fn().mockReturnValueOnce({
        session: jest
          .fn()
          .mockResolvedValue(activityObjectIds.map((id) => ({ activity: id }))),
      });

      mockWorksheetActivityModel.deleteMany = jest.fn().mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(mockDeleteResult),
      });

      mockWorksheetActivityModel.countDocuments = jest
        .fn()
        .mockReturnValueOnce({
          session: jest.fn().mockResolvedValue(0),
        });

      mockWorksheetModel.deleteOne = jest.fn().mockReturnValueOnce({
        session: jest.fn().mockResolvedValue({}),
      });

      const result = await service.removeActivitiesFromWorksheet(
        userId,
        organizationId,
        worksheetId,
        activityIds,
      );

      expect(result).toEqual({
        worksheetId: mockWorksheet._id,
        removedCount: 2,
        worksheetDeleted: true,
      });
      expect(sessionMock.commitTransaction).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });

    it('should throw NotFoundException if worksheet not found', async () => {
      mockWorksheetModel.findById = jest.fn().mockResolvedValue(null);

      await expect(
        service.removeActivitiesFromWorksheet(
          userId,
          organizationId,
          worksheetId,
          activityIds,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if user/org mismatch', async () => {
      const mockWorksheet = {
        _id: worksheetId,
        user: new Types.ObjectId().toString(),
        organization: new Types.ObjectId().toString(),
      };

      mockWorksheetModel.findById = jest.fn().mockResolvedValue(mockWorksheet);

      await expect(
        service.removeActivitiesFromWorksheet(
          userId,
          organizationId,
          worksheetId,
          activityIds,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if some activityIds are not linked to the worksheet', async () => {
      const mockWorksheet = {
        _id: worksheetId,
        user: userId,
        organization: organizationId,
      };

      mockWorksheetModel.findById = jest.fn().mockResolvedValue(mockWorksheet);

      mockWorksheetActivityModel.find = jest.fn().mockReturnValueOnce({
        session: jest.fn().mockResolvedValue([]), // No valid activities
      });

      await expect(
        service.removeActivitiesFromWorksheet(
          userId,
          organizationId,
          worksheetId,
          activityIds,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown errors', async () => {
      const mockWorksheet = {
        _id: worksheetId,
        user: userId,
        organization: organizationId,
      };

      mockWorksheetModel.findById = jest.fn().mockResolvedValue(mockWorksheet);

      mockWorksheetActivityModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected DB Error');
      });

      await expect(
        service.removeActivitiesFromWorksheet(
          userId,
          organizationId,
          worksheetId,
          activityIds,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getProjectWorksheetAnalytics', () => {
    const projectId = new Types.ObjectId().toString();
    const organizationId = new Types.ObjectId().toString();

    const makeActivity = (start: string, end: string) => ({
      startTime: new Date(start),
      endTime: new Date(end),
    });

    const durationsMap: Record<string, any[]> = {
      today: [makeActivity('2025-05-22T08:00:00Z', '2025-05-22T09:00:00Z')],
      yesterday: [makeActivity('2025-05-21T08:00:00Z', '2025-05-21T09:30:00Z')],
      thisWeek: [makeActivity('2025-05-20T08:00:00Z', '2025-05-20T10:00:00Z')],
      lastWeek: [makeActivity('2025-05-13T08:00:00Z', '2025-05-13T09:00:00Z')],
      thisMonth: [makeActivity('2025-05-01T08:00:00Z', '2025-05-01T09:00:00Z')],
      lastMonth: [makeActivity('2025-04-01T08:00:00Z', '2025-04-01T08:30:00Z')],
      allTime: [makeActivity('2025-01-01T08:00:00Z', '2025-01-01T09:00:00Z')],
    };

    beforeEach(() => {
      jest.clearAllMocks();

      // Set up the correct order of aggregate mock calls:
      const mockCalls = [
        durationsMap.today,
        durationsMap.yesterday,
        durationsMap.thisWeek,
        durationsMap.lastWeek,
        durationsMap.thisMonth,
        durationsMap.lastMonth,
        durationsMap.allTime,
      ];
      mockWorksheetModel.aggregate.mockImplementation(() => {
        return Promise.resolve(mockCalls.shift());
      });
    });

    it('should return correctly calculated durations and percent changes', async () => {
      const result = await service.getProjectWorksheetAnalytics(projectId, organizationId);

      expect(result.today.totalSeconds).toBe(3600);
      // expect(result.yesterday.totalSeconds).toBe(5400);
      expect(result.thisWeek.totalSeconds).toBe(7200);
      // expect(result.lastWeek.totalSeconds).toBe(3600);
      expect(result.thisMonth.totalSeconds).toBe(3600);
      // expect(result.lastMonth.totalSeconds).toBe(1800);
      expect(result.allTime.totalSeconds).toBe(3600);

      expect(result.today.percentChangeFromYesterday).toBeCloseTo(-33.33, 1);
      expect(result.thisWeek.percentChangeFromLastWeek).toBeCloseTo(100, 1);
      expect(result.thisMonth.percentChangeFromLastMonth).toBeCloseTo(100, 1);
    });

    it('should handle zero durations safely (no divide-by-zero)', async () => {
      mockWorksheetModel.aggregate.mockResolvedValue([]);

      const result = await service.getProjectWorksheetAnalytics(projectId, organizationId);

      expect(result.today.totalSeconds).toBe(0);
      expect(result.today.percentChangeFromYesterday).toBe(0);
      expect(result.thisWeek.percentChangeFromLastWeek).toBe(0);
      expect(result.thisMonth.percentChangeFromLastMonth).toBe(0);
      expect(result.allTime.totalSeconds).toBe(0);
    });

    it('should skip activities with missing startTime or endTime', async () => {
      mockWorksheetModel.aggregate.mockImplementationOnce(() =>
        Promise.resolve([
          { startTime: null, endTime: null },
          { startTime: new Date('2025-05-22T10:00:00Z'), endTime: null },
        ])
      ).mockResolvedValue([]);

      const result = await service.getProjectWorksheetAnalytics(projectId, organizationId);

      expect(result.today.totalSeconds).toBe(0); // Should skip all broken entries
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockWorksheetModel.aggregate.mockRejectedValueOnce(new Error('Mongo crash'));

      await expect(
        service.getProjectWorksheetAnalytics(projectId, organizationId),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should rethrow known HTTP exceptions', async () => {
      const badReq = new BadRequestException('Bad request');
      mockWorksheetModel.aggregate.mockRejectedValueOnce(badReq);

      await expect(
        service.getProjectWorksheetAnalytics(projectId, organizationId),
      ).rejects.toThrow(BadRequestException);
    });
  });

});
