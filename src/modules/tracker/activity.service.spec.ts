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
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ActivitySession } from './tracker.interface';

// Mocks
const mockActivityModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  insertMany: jest.fn(),
  aggregate: jest.fn(),
};

const mockApplicationModel = {};
const mockWorksheetModel = {};
const mockWorksheetActivityModel = {};

const mockApplicationService = {
  findOrCreate: jest.fn(),
};

const mockOrganizationService = {
  verifyUserofOrg: jest.fn(),
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
        { provide: OrganizationService, useValue: mockOrganizationService },
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
      mockOrganizationService.verifyUserofOrg.mockResolvedValue(true);
      mockActivityLogQueue.add.mockResolvedValue({});

      const result = await service.addActivityLogsToQueue(
        userId,
        organizationId,
        sampleLogs,
      );

      expect(mockOrganizationService.verifyUserofOrg).toHaveBeenCalledWith(
        userId,
        organizationId,
      );
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

    it('should throw UnauthorizedException if user is not in organization', async () => {
      mockOrganizationService.verifyUserofOrg.mockResolvedValue(false);

      await expect(
        service.addActivityLogsToQueue(userId, organizationId, sampleLogs),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return queued: 0 if inputs are invalid or empty', async () => {
      const result = await service.addActivityLogsToQueue('', '', []);
      expect(result).toEqual({ queued: 0 });
      expect(mockActivityLogQueue.add).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unknown error', async () => {
      mockOrganizationService.verifyUserofOrg.mockImplementation(() => {
        throw new Error('unexpected failure');
      });

      await expect(
        service.addActivityLogsToQueue(userId, organizationId, sampleLogs),
      ).rejects.toThrow(InternalServerErrorException);
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

      const result = await service.createActivitiesFromSession(
        [baseSession],
        userId,
        organizationId,
      );

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

      mockActivityModel.insertMany.mockResolvedValue([
        { name: 'Google', pid: 1234 },
      ]);

      const result = await service.createActivitiesFromSession(
        [baseSession],
        userId,
        organizationId,
      );

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

      const result = await service.createActivitiesFromSession(
        [baseSession],
        userId,
        organizationId,
      );

      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockActivityModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      mockApplicationService.findOrCreate.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.createActivitiesFromSession(
          [baseSession],
          userId,
          organizationId,
        ),
      ).rejects.toThrow('DB error');
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

      mockOrganizationService.verifyUserofOrg.mockResolvedValue(true);
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

      expect(mockOrganizationService.verifyUserofOrg).toHaveBeenCalledWith(
        userId,
        organizationId,
      );
      expect(mockActivityModel.aggregate).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.paginationMetadata.totalCount).toBe(1);
    });

    it("should default to today's date if date is not provided", async () => {
      mockOrganizationService.verifyUserofOrg.mockResolvedValue(true);
      mockActivityModel.aggregate.mockResolvedValue([
        { data: [], totalCount: [] },
      ]);

      const result = await service.findUnreportedActivitiesForCurrentUser(
        userId,
        organizationId,
        undefined,
        timezone,
      );

      expect(result.paginationMetadata.totalCount).toBe(0);
      expect(mockActivityModel.aggregate).toHaveBeenCalled();
    });

    it('should throw an error if user is not in the organization', async () => {
      mockOrganizationService.verifyUserofOrg.mockRejectedValue(
        new UnauthorizedException(),
      );

      await expect(
        service.findUnreportedActivitiesForCurrentUser(
          userId,
          organizationId,
          '2025-05-18',
          timezone,
        ),
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw if aggregate fails', async () => {
      mockOrganizationService.verifyUserofOrg.mockResolvedValue(true);
      mockActivityModel.aggregate.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.findUnreportedActivitiesForCurrentUser(
          userId,
          organizationId,
          '2025-05-18',
          timezone,
        ),
      ).rejects.toThrow('Unable to fetch unreported activities.');
    });
  });

  describe('validateActivitiesForUser', () => {
    const userId = new Types.ObjectId();
    const organizationId = new Types.ObjectId();
    const validActivityIds = [
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
    ];
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

      const result = await service.validateActivitiesForUser(
        userId,
        organizationId,
        validActivityIds,
      );

      expect(mockActivityModel.find).toHaveBeenCalledWith({
        _id: { $in: validActivityIds.map((id) => new Types.ObjectId(id)) },
        user: userId,
        organization: organizationId,
      });

      expect(result).toEqual(activityDocs);
    });

    it('should throw BadRequestException if some activities are invalid', async () => {
      mockActivityModel.find.mockResolvedValue([activityDocs[0]]); // only 1 returned

      await expect(
        service.validateActivitiesForUser(
          userId,
          organizationId,
          validActivityIds,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid ObjectId', async () => {
      const invalidIds = ['notanid'];

      await expect(
        service.validateActivitiesForUser(userId, organizationId, invalidIds),
      ).rejects.toThrow(BadRequestException);

      expect(mockActivityModel.find).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      const error = new Error('Mongo error');
      mockActivityModel.find.mockRejectedValue(error);

      await expect(
        service.validateActivitiesForUser(
          userId,
          organizationId,
          validActivityIds,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      // expect(mockLogger.error).toHaveBeenCalledWith(
      //   'Activity validation failed',
      //   expect.any(Error),
      // );
    });
  });
});
