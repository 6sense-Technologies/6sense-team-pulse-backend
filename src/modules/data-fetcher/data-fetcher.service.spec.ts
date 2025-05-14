import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { DataFetcherService } from './data-fetcher.service';
import { Tool } from '../../schemas/Tool.schema';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { Users } from '../../schemas/users.schema';
import { of } from 'rxjs';
import mongoose from 'mongoose';

describe('DataFetcherService', () => {
  let service: DataFetcherService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockToolModel = {
    find: jest.fn(),
  };

  const mockIssueEntryModel = {
    findOneAndUpdate: jest.fn(),
  };

  const mockUserModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataFetcherService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getModelToken(Tool.name),
          useValue: mockToolModel,
        },
        {
          provide: getModelToken(IssueEntry.name),
          useValue: mockIssueEntryModel,
        },
        {
          provide: getModelToken(Users.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<DataFetcherService>(DataFetcherService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dataFetchFromJIRA', () => {
    it('should fetch and transform JIRA data', async () => {
      const mockResponse = {
        data: {
          issues: [
            {
              id: '123',
              key: 'TEST-1',
              fields: {
                created: '2024-02-23T10:00:00.000Z',
                duedate: '2024-02-23',
                summary: 'Test Issue',
                issuetype: { name: 'Task' },
                status: { name: 'Open' },
                assignee: {
                  accountId: 'test-account',
                  displayName: 'Test User',
                },
              },
            },
          ],
          total: 1,
        },
      };

      mockConfigService.get.mockReturnValueOnce('test@email.com');
      mockConfigService.get.mockReturnValueOnce('test-token');
      mockHttpService.post.mockReturnValueOnce(of(mockResponse));

      const result = await service.dataFetchFromJIRA({
        projectUrl: 'https://test.atlassian.net',
        date: '2024-02-23',
      });

      expect(result).toBeDefined();
      expect(result[0].issueId).toBe('123');
      expect(result[0].accountId).toBe('test-account');
    });
  });

  describe('fetchDataFromAllToolUrls', () => {
    it('should fetch data from all JIRA tools', async () => {
      const mockObjectId = new mongoose.Types.ObjectId(); // Create a valid ObjectId

      mockToolModel.find.mockResolvedValueOnce([
        { toolUrl: 'https://test.atlassian.net' },
      ]);

      const mockIssueData = [
        {
          accountId: 'test-account',
          issueId: '123',
          projectUrl: 'https://test.atlassian.net',
          issueIdUrl: 'https://test.atlassian.net/browse/TEST-1',
          issueLinkUrl: '',
          issueType: 'Task',
          issueStatus: 'Open',
          issueSummary: 'Test Issue',
          planned: true,
          date: '2024-02-23T10:00:00.000Z',
          comment: '',
        },
      ];

      mockUserModel.find.mockResolvedValueOnce([
        {
          id: mockObjectId.toString(), // Use the valid ObjectId
          displayName: 'Test User',
        },
      ]);

      mockIssueEntryModel.findOneAndUpdate.mockResolvedValueOnce({});

      // Mock the dataFetchFromJIRA method
      jest
        .spyOn(service, 'dataFetchFromJIRA')
        .mockResolvedValueOnce(mockIssueData as any);

      const result = await service.fetchDataFromAllToolUrls();

      expect(result).toBe('DONE');
      expect(mockToolModel.find).toHaveBeenCalled();
      expect(service.dataFetchFromJIRA).toHaveBeenCalled();
      expect(mockIssueEntryModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          issueId: '123',
          projectUrl: 'https://test.atlassian.net',
          user: expect.any(mongoose.Types.ObjectId),
        }),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('getTime', () => {
    it('should convert time to Bangladesh timezone', () => {
      const result = service['getTime']('2024-02-23T10:00:00.000Z');
      expect(result).toHaveProperty('hour');
      expect(result).toHaveProperty('minute');
      expect(result).toHaveProperty('amPm');
    });
  });
});
