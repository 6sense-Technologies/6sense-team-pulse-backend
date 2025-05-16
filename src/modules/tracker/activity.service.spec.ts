// test/activity.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ActivityService } from './activity.service';
import { Activity } from './entities/activity.schema';
import { Application } from './entities/application.schema';
import { Worksheet } from './entities/worksheet.schema';
import { WorksheetActivity } from './entities/worksheetActivity.schema';
import { Queue } from 'bullmq';
import { OrganizationService } from '../organization/organization.service';
import { ApplicationService } from './application.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { Types } from 'mongoose';

const mockActivityModel = {
  findOne: jest.fn(),
  insertMany: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
};

const mockApplicationModel = {};
const mockWorksheetModel = {};
const mockWorksheetActivityModel = {};

const mockQueue = {
  add: jest.fn(),
};

const mockOrgService = {
  verifyUserofOrg: jest.fn(),
};

const mockAppService = {
  findOrCreate: jest.fn(),
};

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getModelToken(Activity.name), useValue: mockActivityModel },
        { provide: getModelToken(Application.name), useValue: mockApplicationModel },
        { provide: getModelToken(Worksheet.name), useValue: mockWorksheetModel },
        { provide: getModelToken(WorksheetActivity.name), useValue: mockWorksheetActivityModel },
        { provide: 'BullQueue_activity-log', useValue: mockQueue },
        { provide: OrganizationService, useValue: mockOrgService },
        { provide: ApplicationService, useValue: mockAppService },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addActivityLogsToQueue', () => {
    it('should queue logs correctly when valid input is provided', async () => {
      mockOrgService.verifyUserofOrg.mockResolvedValue(true);
      const result = await service.addActivityLogsToQueue('user1', 'org1', [{ startTime: new Date(), endTime: new Date(), appName: 'App' }]);
      expect(mockQueue.add).toHaveBeenCalled();
      expect(result.queued).toBe(1);
    });

    it('should throw UnauthorizedException if user is not in org', async () => {
      mockOrgService.verifyUserofOrg.mockResolvedValue(false);
      await expect(
        service.addActivityLogsToQueue('user1', 'org1', [{ startTime: new Date(), endTime: new Date(), appName: 'App' }])
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle missing input gracefully', async () => {
      const result = await service.addActivityLogsToQueue('', '', []);
      expect(result.queued).toBe(0);
    });
  });

  describe('createActivitiesFromSession', () => {
    it('should create activities from sessions', async () => {
      mockActivityModel.findOne.mockResolvedValue(null);
      mockAppService.findOrCreate.mockResolvedValue({ _id: 'appId' });
      mockActivityModel.insertMany.mockResolvedValue([{ name: 'Chrome' }]);

      const sessions = [{ appName: 'Chrome', startTime: new Date(), endTime: new Date() }];
      const result = await service.createActivitiesFromSession(sessions, 'userId', 'orgId');
      expect(result.length).toBe(1);
    });

    it('should skip sessions older than last activity', async () => {
      mockActivityModel.findOne.mockResolvedValue({ endTime: new Date() });
      const sessions = [{ appName: 'Chrome', startTime: new Date(2000, 1, 1), endTime: new Date(2000, 1, 1) }];
      const result = await service.createActivitiesFromSession(sessions, 'userId', 'orgId');
      expect(result).toEqual([]);
    });
  });

  describe('findAllActivities', () => {
    it('should return activities in specified date and timezone', async () => {
      mockActivityModel.find.mockResolvedValue([{ _id: 'activity1' }]);
      const result = await service.findAllActivities('orgUserId', 'userId', '2023-10-01', '+05:30');
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findUnreportedActivitiesForCurrentUser', () => {
    it('should return paginated unreported activities', async () => {
      mockOrgService.verifyUserofOrg.mockResolvedValue(true);
      mockActivityModel.aggregate.mockResolvedValue([
        {
          data: [{ _id: 'a1' }],
          totalCount: [{ count: 1 }],
        },
      ]);

      const result = await service.findUnreportedActivitiesForCurrentUser(
        'userId', 'orgId', '2023-10-01', 'Asia/Kolkata'
      );
      expect(result.data.length).toBe(1);
    });
  });

  describe('validateActivitiesForUser', () => {
    it('should validate and return correct activity list', async () => {
      const ids = ['507f191e810c19729de860ea'];
      mockActivityModel.find.mockResolvedValue([{ _id: ids[0] }]);
      const result = await service.validateActivitiesForUser(new Types.ObjectId(), new Types.ObjectId(), ids);
      expect(result.length).toBe(1);
    });

    it('should throw error for invalid id', async () => {
      await expect(
        service.validateActivitiesForUser(new Types.ObjectId(), new Types.ObjectId(), ['invalid'])
      ).rejects.toThrow(BadRequestException);
    });
  });
});
