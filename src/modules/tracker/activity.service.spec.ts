import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { getModelToken } from '@nestjs/mongoose';
import { Activity } from './entities/activity.schema';
import { Application } from './entities/application.schema';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { ApplicationService } from './application.service';
import { OrganizationService } from '../organization/organization.service';
import { ActivityLogEntryDto } from './dto/create-activities.dto';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ActivitySession } from './tracker.interface';
import { CreateManualActivityDto } from './dto/create-manaul-activity.dto';

// Mocks
const mockActivityModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  insertMany: jest.fn(),
  aggregate: jest.fn(),
  insertOne: jest.fn(),
};

const mockApplicationModel = {};
const mockWorksheetModel = {};
const mockWorksheetActivityModel = {};

const mockApplicationService = {
  findOrCreate: jest.fn(),
};

const mockActivityLogQueue = {
  add: jest.fn(),
};

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getModelToken(Activity.name), useValue: mockActivityModel },
        {
          provide: getModelToken(Application.name),
          useValue: mockApplicationModel,
        },
        {
          provide: getModelToken(Worksheet.name),
          useValue: mockWorksheetModel,
        },
        {
          provide: getModelToken(WorksheetActivity.name),
          useValue: mockWorksheetActivityModel,
        },
        { provide: ApplicationService, useValue: mockApplicationService },
        { provide: 'BullQueue_activity-log', useValue: mockActivityLogQueue }, // ✅ Correct token
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addActivityLogsToQueue', () => {
    const userId = 'user123';
    const organizationId = 'org456';

    const sampleLogs: ActivityLogEntryDto[] = [
      {
        app_name: 'Chrome',
        app_path: '/Applications/Google Chrome.app',
        pid: 111,
        browser_url: 'http://google.com',
        window_title: 'Google Homepage',
        favicon_url: 'http://favicon.com',
        event: 'focused',
        timestamp: new Date().toISOString(),
        duration_sec: 10,
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should queue logs and return count when input is valid', async () => {
      mockActivityLogQueue.add.mockResolvedValue({});

      const result = await service.addActivityLogsToQueue(userId, organizationId, sampleLogs);

      expect(mockActivityLogQueue.add).toHaveBeenCalledWith(
        'process-activity',
        expect.objectContaining({
          user_id: userId,
          organization_id: organizationId,
          logs: sampleLogs,
        }),
        expect.objectContaining({
          jobId: expect.any(String),
          removeOnComplete: true,
        }),
      );
      expect(result).toEqual({ queued: sampleLogs.length });
    });

    it('should return queued: 0 if inputs are invalid or empty', async () => {
      const result = await service.addActivityLogsToQueue('', '', []);
      expect(result).toEqual({ queued: 0 });
      expect(mockActivityLogQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('createActivitiesFromSession', () => {
    const userId = new Types.ObjectId().toHexString();
    const organizationId = new Types.ObjectId().toHexString();

    const baseSession: ActivitySession = {
      startTime: '2025-05-18T12:00:00Z',
      endTime: '2025-05-18T12:10:00Z',
      appName: 'Chrome',
      faviconUrl: 'http://favicon.com',
      windowTitle: 'Google',
      pid: 1234,
      browserUrl: 'http://google.com',
      organization: new Types.ObjectId(organizationId).toHexString(),
      user: new Types.ObjectId(userId).toHexString(),
    };

    it('should skip sessions older than latest activity', async () => {
      mockActivityModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          endTime: new Date('2025-05-19T00:00:00Z'), // future of baseSession
        }),
      });

      const result = await service.createActivitiesFromSession([baseSession], userId, organizationId);

      expect(result).toEqual([]);
      expect(mockActivityModel.insertMany).not.toHaveBeenCalled();
    });

    it('should insert new activities if valid', async () => {
      mockActivityModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null), // no latest activity
      });

      mockApplicationService.findOrCreate.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      mockActivityModel.insertMany.mockResolvedValue([{ name: 'Google', pid: 1234 }]);

      const result = await service.createActivitiesFromSession([baseSession], userId, organizationId);

      expect(result.length).toBe(1);
      expect(mockActivityModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Google',
            pid: 1234,
            application: expect.any(Types.ObjectId),
          }),
        ]),
      );
    });

    it('should return empty array if nothing to insert', async () => {
      mockActivityModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          endTime: new Date('2025-05-18T12:30:00Z'),
        }),
      });

      const result = await service.createActivitiesFromSession([baseSession], userId, organizationId);

      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockActivityModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      mockApplicationService.findOrCreate.mockRejectedValue(new Error('DB error'));

      await expect(service.createActivitiesFromSession([baseSession], userId, organizationId)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('findUnreportedActivitiesForCurrentUser', () => {
    const userId = '507f1f77bcf86cd799439011'; // valid 24-char hex
    const organizationId = '507f1f77bcf86cd799439012';
    const timezone = 'Asia/Dhaka';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return unreported activities with pagination metadata', async () => {
      const mockAggregateResult = [
        {
          data: [{ _id: 'a1', startTime: new Date() }],
          totalCount: [{ count: 1 }],
        },
      ];

      mockActivityModel.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await service.findUnreportedActivitiesForCurrentUser(
        userId,
        organizationId,
        '2025-05-18',
        timezone,
        'latest',
        1,
        10,
      );

      expect(mockActivityModel.aggregate).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.paginationMetadata.totalCount).toBe(1);
    });

    it("should default to today's date if date is not provided", async () => {
      mockActivityModel.aggregate.mockResolvedValue([{ data: [], totalCount: [] }]);

      const result = await service.findUnreportedActivitiesForCurrentUser(userId, organizationId, undefined, timezone);

      expect(result.paginationMetadata.totalCount).toBe(0);
      expect(mockActivityModel.aggregate).toHaveBeenCalled();
    });

    it('should throw if aggregate fails', async () => {
      mockActivityModel.aggregate.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.findUnreportedActivitiesForCurrentUser(userId, organizationId, '2025-05-18', timezone),
      ).rejects.toThrow('Unable to fetch unreported activities.');
    });
  });

  describe('validateActivitiesForUser', () => {
    const userId = new Types.ObjectId();
    const organizationId = new Types.ObjectId();
    const validActivityIds = [new Types.ObjectId().toHexString(), new Types.ObjectId().toHexString()];
    const activityDocs = validActivityIds.map((id) => ({
      _id: new Types.ObjectId(id),
      user: userId,
      organization: organizationId,
    }));

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return valid activities for correct user and org', async () => {
      mockActivityModel.find.mockResolvedValue(activityDocs);

      const result = await service.validateActivitiesForUser(userId, organizationId, validActivityIds);

      expect(mockActivityModel.find).toHaveBeenCalledWith({
        _id: { $in: validActivityIds.map((id) => new Types.ObjectId(id)) },
        user: userId,
        organization: organizationId,
      });

      expect(result).toEqual(activityDocs);
    });

    it('should throw BadRequestException if some activities are invalid', async () => {
      mockActivityModel.find.mockResolvedValue([activityDocs[0]]); // only 1 returned

      await expect(service.validateActivitiesForUser(userId, organizationId, validActivityIds)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid ObjectId', async () => {
      const invalidIds = ['notanid'];

      await expect(service.validateActivitiesForUser(userId, organizationId, invalidIds)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockActivityModel.find).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      const error = new Error('Mongo error');
      mockActivityModel.find.mockRejectedValue(error);

      await expect(service.validateActivitiesForUser(userId, organizationId, validActivityIds)).rejects.toThrow(
        InternalServerErrorException,
      );

      // expect(mockLogger.error).toHaveBeenCalledWith(
      //   'Activity validation failed',
      //   expect.any(Error),
      // );
    });
  });

  describe('createManualActivity', () => {
    const userId = new Types.ObjectId().toHexString();
    const organizationId = new Types.ObjectId().toHexString();

    const validDto: CreateManualActivityDto = {
      name: 'Design UI',
      manualType: 'Designing',
      startTime: new Date('2025-05-20T10:00:00Z').toISOString(),
      endTime: new Date('2025-05-20T11:00:00Z').toISOString(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully create a manual activity when data is valid', async () => {
      const mockInsertedActivity = {
        insertedId: new Types.ObjectId(),
        acknowledged: true,
      };

      mockActivityModel.insertOne.mockResolvedValue(mockInsertedActivity);

      const result = await service.createManualActivity(validDto, userId, organizationId);

      expect(mockActivityModel.insertOne).toHaveBeenCalledWith({
        name: validDto.name,
        startTime: validDto.startTime,
        endTime: validDto.endTime,
        organization: new Types.ObjectId(organizationId),
        user: new Types.ObjectId(userId),
        manualType: validDto.manualType,
      });

      expect(result).toEqual(mockInsertedActivity);
    });

    it('should throw BadRequestException if endTime is before or equal to startTime', async () => {
      const invalidDto = {
        ...validDto,
        endTime: validDto.startTime,
      };

      await expect(service.createManualActivity(invalidDto, userId, organizationId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockActivityModel.insertOne).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      const errorMessage = 'DB insert failed';
      mockActivityModel.insertOne.mockRejectedValue(new Error(errorMessage));

      await expect(service.createManualActivity(validDto, userId, organizationId)).rejects.toThrow(errorMessage);

      expect(mockActivityModel.insertOne).toHaveBeenCalled();
    });
  });

  // describe('editManualActivity', () => {
  //   const userId = new Types.ObjectId().toString();
  //   const organizationId = new Types.ObjectId().toString();
  //   const activityId = new Types.ObjectId().toString();

  //   const existingActivity = {
  //     _id: new Types.ObjectId(activityId),
  //     name: 'Old Name',
  //     manualType: 'Meeting',
  //     startTime: new Date('2025-05-21T09:00:00Z'),
  //     endTime: new Date('2025-05-21T10:00:00Z'),
  //     user: new Types.ObjectId(userId),
  //     organization: new Types.ObjectId(organizationId),
  //     save: jest.fn().mockResolvedValue(true),
  //   };

  //   beforeEach(() => {
  //     mockActivityModel.findOne.mockResolvedValue(existingActivity);
  //   });

  //   it('should update and return the manual activity when authorized', async () => {
  //     const updateDto = {
  //       name: 'Updated Meeting',
  //       manualType: 'Collaboration',
  //       startTime: new Date('2025-05-21T09:30:00Z').toISOString(),
  //       endTime: new Date('2025-05-21T10:30:00Z').toISOString(),
  //     };

  //     const result = await service.editManualActivity(activityId, userId, organizationId, updateDto);
  //     expect(existingActivity.save).toHaveBeenCalled();
  //     expect(result.name).toBe(updateDto.name);
  //     expect(result.manualType).toBe(updateDto.manualType);
  //   });

  //   it('should throw BadRequestException when endTime is before startTime', async () => {
  //     const updateDto = {
  //       startTime: new Date('2025-05-21T10:30:00Z').toISOString(),
  //       endTime: new Date('2025-05-21T09:30:00Z').toISOString(),
  //     };

  //     await expect(
  //       service.editManualActivity(activityId, userId, organizationId, updateDto),
  //     ).rejects.toThrow(BadRequestException);
  //   });

  //   it('should throw UnauthorizedException when user does not own activity', async () => {
  //     const anotherUserId = new Types.ObjectId().toString();

  //     await expect(
  //       service.editManualActivity(activityId, anotherUserId, organizationId, { name: 'Test' }),
  //     ).rejects.toThrow(UnauthorizedException);
  //   });

  //   it('should throw BadRequestException if activity is not manual', async () => {
  //     mockActivityModel.findOne.mockResolvedValue({
  //       ...existingActivity,
  //       manualType: undefined,
  //     });

  //     await expect(
  //       service.editManualActivity(activityId, userId, organizationId, { name: 'Test' }),
  //     ).rejects.toThrow(BadRequestException);
  //   });
  // });

  describe('editManualActivity', () => {
    const userId = new Types.ObjectId().toHexString();
    const organizationId = new Types.ObjectId().toHexString();
    const activityId = new Types.ObjectId().toHexString();

    const mockActivity = {
      _id: activityId,
      name: 'Old Name',
      manualType: 'Planning',
      startTime: new Date('2025-05-20T10:00:00Z'),
      endTime: new Date('2025-05-20T11:00:00Z'),
      organization: new Types.ObjectId(organizationId),
      user: new Types.ObjectId(userId),
      save: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockActivityModel.findOne.mockReset();
    });

    it('should update the manual activity successfully', async () => {
      mockActivityModel.findOne.mockResolvedValue(mockActivity);

      const updateDto: Partial<CreateManualActivityDto> = {
        name: 'Updated Name',
        manualType: 'Researching',
        startTime: '2025-05-20T12:00:00Z',
        endTime: '2025-05-20T13:00:00Z',
      };

      const result = await service.editManualActivity(activityId, userId, organizationId, updateDto);

      expect(mockActivityModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(activityId),
      });

      expect(mockActivity.save).toHaveBeenCalled();
      expect(result.name).toBe(updateDto.name);
      expect(result.manualType).toBe(updateDto.manualType);
    });

    it('should throw BadRequestException for invalid ObjectId', async () => {
      await expect(service.editManualActivity('invalid-id', userId, organizationId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if activity is not found', async () => {
      mockActivityModel.findOne.mockResolvedValue(null);

      await expect(service.editManualActivity(activityId, userId, organizationId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException if user mismatch', async () => {
      const unauthorizedActivity = {
        ...mockActivity,
        user: new Types.ObjectId(),
      };
      mockActivityModel.findOne.mockResolvedValue(unauthorizedActivity);

      await expect(service.editManualActivity(activityId, userId, organizationId, {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException if not a manual activity', async () => {
      const nonManualActivity = { ...mockActivity, manualType: undefined };
      mockActivityModel.findOne.mockResolvedValue(nonManualActivity);

      await expect(service.editManualActivity(activityId, userId, organizationId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if endTime is before startTime', async () => {
      mockActivityModel.findOne.mockResolvedValue(mockActivity);

      const invalidDto = {
        startTime: '2025-05-20T13:00:00Z',
        endTime: '2025-05-20T12:00:00Z',
      };

      await expect(service.editManualActivity(activityId, userId, organizationId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException for unexpected error', async () => {
      mockActivityModel.findOne.mockRejectedValue(new Error('Unexpected'));

      await expect(service.editManualActivity(activityId, userId, organizationId, {})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
