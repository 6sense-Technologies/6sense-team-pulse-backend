import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { of } from 'rxjs';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { Tool } from '../../schemas/Tool.schema';
import { Users } from '../../schemas/users.schema';
import { LinearService } from '../linear/linear.service';
import { DataFetcherService } from './data-fetcher.service';

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
    aggregate: jest.fn(),
    exec: jest.fn(),
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
        {
          provide: LinearService,
          useValue: {
            fetchAndSaveIssuesFromLinear: jest.fn(),
          },
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
        organizationId: 'test-org',
      });

      expect(result).toBeDefined();
      expect(result[0].issueId).toBe('123');
      expect(result[0].accountId).toBe('test-account');
    });
  });

  describe('fetchDataFromAllToolUrls', () => {
    it('should fetch data from all JIRA tools', async () => {
      const mockObjectId = new mongoose.Types.ObjectId();

      mockToolModel.find.mockResolvedValueOnce([{ toolUrl: 'https://test.atlassian.net' }]);

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
          id: mockObjectId.toString(),
          displayName: 'Test User',
        },
      ]);

      mockIssueEntryModel.findOneAndUpdate.mockResolvedValueOnce({});

      jest
        .spyOn(service, 'fetchDataFromAllToolUrls')
        .mockImplementationOnce(() => ({ exec: jest.fn() }) as any);
      jest.spyOn(service, 'dataFetchFromJIRA').mockResolvedValueOnce(mockIssueData as any);

      await service.fetchDataFromAllToolUrls(true);
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
