import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JiraService } from './jira.service';
import { HttpService } from '@nestjs/axios';
import { UserService } from '../users/users.service';
import { User } from '../../schemas/user.schema';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { Model } from 'mongoose';
import { TrelloService } from '../trello/trello.service'; // Import TrelloService

describe('JiraService', () => {
  let jiraService: JiraService;
  let userModelMock: jest.Mocked<Model<User>>;
  let issueEntryModelMock: jest.Mocked<Model<IssueEntry>>;

  const mockUser = {
    id: '64c5b8f9d7e9b8f9d7e9b8f9',
    accountId: 'mockAccountId',
    displayName: 'John Doe',
  };

  const mockData = [
    {
      accountId: 'mockAccountId',
      issueId: 'ISSUE-123',
      issueName: 'Bug',
      issueStatus: 'In Progress',
      issueSummary: 'Fix login issue',
      planned: 5,
      issueLinks: 'https://example.com/issue/123',
    },
    {
      accountId: 'nonExistentAccountId',
      issueId: 'ISSUE-456',
      issueName: 'Task',
      issueStatus: 'To Do',
      issueSummary: 'Write documentation',
      planned: 3,
      issueLinks: '',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JiraService,
        {
          provide: HttpService,
          useValue: {}, // Mock HttpService
        },
        {
          provide: TrelloService,
          useValue: {}, // Mock TrelloService
        },
        {
          provide: UserService,
          useValue: {}, // Mock UserService
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(IssueEntry.name),
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    jiraService = module.get<JiraService>(JiraService);
    userModelMock = module.get(getModelToken(User.name));
    issueEntryModelMock = module.get(getModelToken(IssueEntry.name));
  });

  describe('fetchAndSaveFromJira', () => {
    it('should create issue entries for valid users', async () => {
      // Mock user lookup with mockResolvedValueOnce
      userModelMock.findOne
        .mockResolvedValueOnce(mockUser) // First call resolves with mockUser
        .mockResolvedValueOnce(null); // Second call resolves with null

      // Mock issue entry creation
      issueEntryModelMock.create.mockResolvedValue({} as any);

      // Call the method
      await jiraService.fetchAndSaveFromJira(mockData);

      // Verify interactions
      // expect(userModelMock.findOne).toHaveBeenCalledTimes(2); // Called for each item in mockData
      expect(issueEntryModelMock.create).toHaveBeenCalledTimes(1); // Only one valid user exists

      // Verify the created issue entry
      expect(issueEntryModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 0,
          issueId: 'ISSUE-123',
          issueType: 'Bug',
          issueStatus: 'In Progress',
          issueSummary: 'Fix login issue',
          username: 'John Doe',
          planned: 5,
          link: 'https://example.com/issue/123',
          accountId: 'mockAccountId',
          user: expect.any(Object), // ObjectId
          date: expect.any(String), // Date string
          insight: '',
        }),
      );
    });

    it('should not create issue entries for non-existent users', async () => {
      // Mock user lookup to return null for all calls
      userModelMock.findOne.mockResolvedValue(null);

      // Call the method
      await jiraService.fetchAndSaveFromJira(mockData);

      // Verify no issue entries are created
      expect(issueEntryModelMock.create).not.toHaveBeenCalled();
    });

    it('should handle empty input data gracefully', async () => {
      // Call the method with empty data
      await jiraService.fetchAndSaveFromJira([]);

      // Verify no database interactions
      expect(userModelMock.findOne).not.toHaveBeenCalled();
      expect(issueEntryModelMock.create).not.toHaveBeenCalled();
    });
  });
});
