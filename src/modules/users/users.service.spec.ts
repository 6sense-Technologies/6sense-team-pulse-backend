import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { IssueEntry } from './schemas/IssueEntry.schema';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Designation, Project } from './enums/user.enum';

const mockUser = {
  accountId: '1',
  displayName: 'John Doe',
  userFrom: 'New York',
  emailAddress: 'john@example.com',
  avatarUrls: 'http://example.com/avatar.png',
  currentPerformance: 75,
  designation: Designation.JrSQAEngineer,
  project: Project.Pattern50,
  isArchive: false,
  issueHistory: [
    {
      date: '2024-09-24',
      issuesCount: {
        notDone: { Task: 2, Bug: 1, Story: 3 },
        done: { Task: 5, Bug: 2, Story: 4 },
      },
      taskCompletionRate: 80,
      userStoryCompletionRate: 70,
      overallScore: 85,
      comment: 'Good progress this week.',
      notDoneIssues: [
        {
          issueId: 'TASK-101',
          summary: 'Implement login feature',
          status: 'In Progress',
          issueType: 'Task',
          dueDate: '2024-09-30',
          issueLinks: [
            {
              issueId: 'BUG-201',
              issueType: 'Bug',
              summary: 'Fix login error',
              status: 'Open',
            },
          ],
        },
      ],
      doneIssues: [
        {
          issueId: 'TASK-100',
          summary: 'Set up project repository',
          status: 'Done',
          issueType: 'Task',
          dueDate: '2024-09-20',
          issueLinks: [],
        },
      ],
      codeToBugRatio: 1.5,
      reportBug: {
        noOfBugs: 2,
        comment: 'Minor UI bugs reported.',
      },
    },
  ],
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({
    accountId: '1',
    displayName: 'John Doe',
    userFrom: 'New York',
    emailAddress: 'john@example.com',
    avatarUrls: 'http://example.com/avatar.png',
    currentPerformance: 75,
    designation: Designation.JrSQAEngineer,
    project: Project.Pattern50,
    isArchive: false,
    issueHistory: [
      {
        date: '2024-09-24',
        issuesCount: {
          notDone: { Task: 2, Bug: 1, Story: 3 },
          done: { Task: 5, Bug: 2, Story: 4 },
        },
        taskCompletionRate: 80,
        userStoryCompletionRate: 70,
        overallScore: 85,
        comment: 'Good progress this week.',
        notDoneIssues: [
          {
            issueId: 'TASK-101',
            summary: 'Implement login feature',
            status: 'In Progress',
            issueType: 'Task',
            dueDate: '2024-09-30',
            issueLinks: [
              {
                issueId: 'BUG-201',
                issueType: 'Bug',
                summary: 'Fix login error',
                status: 'Open',
              },
            ],
          },
        ],
        doneIssues: [
          {
            issueId: 'TASK-100',
            summary: 'Set up project repository',
            status: 'Done',
            issueType: 'Task',
            dueDate: '2024-09-20',
            issueLinks: [],
          },
        ],
        codeToBugRatio: 1.5,
        reportBug: {
          noOfBugs: 2,
          comment: 'Minor UI bugs reported.',
        },
      },
    ],
  }),
};

const mockUserModel = {
  findOne: jest.fn(),
  findOneAndDelete: jest.fn(),
  create: jest.fn().mockResolvedValue(mockUser),
  countDocuments: jest.fn(),
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue([mockUser]),
  }),
  exec: jest.fn(),
};
const mockIssueHistoryModel = {
  findOne: jest.fn(),
  findOneAndDelete: jest.fn(),
  create: jest.fn().mockResolvedValue(mockUser),
  countDocuments: jest.fn(),
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue([mockUser]),
  }),
  exec: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockIssueEntryModel = jest.fn().mockImplementation((data) => {
  return {
    ...data,
    save: jest.fn().mockResolvedValue(null),
  };
});

describe('UserService', () => {
  let userService: UserService;
  let userModel: Model<User>;
  let issueHistoryModel: Model<IssueHistory>;
  let issueEntryModel: Model<IssueEntry>;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        ConfigService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(IssueHistory.name),
          useValue: mockIssueHistoryModel,
        },
        {
          provide: getModelToken(IssueEntry.name),
          useValue: mockIssueEntryModel,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    issueHistoryModel = module.get<Model<IssueHistory>>(
      getModelToken(IssueHistory.name),
    );
    issueEntryModel = module.get<Model<IssueEntry>>(
      getModelToken(IssueEntry.name),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users with pagination', async () => {
      mockUserModel.countDocuments.mockResolvedValue(2);
      mockUserModel.find.mockReturnValue(mockUserModel);
      mockUserModel.limit.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUser]),
      });

      const result = await userService.getAllUsers(1, 10);

      expect(mockUserModel.countDocuments).toHaveBeenCalledWith({
        isArchive: false,
      });
      expect(mockUserModel.find).toHaveBeenCalledWith(
        { isArchive: false },
        'accountId displayName emailAddress avatarUrls currentPerformance designation project',
      );
      expect(result).toEqual({
        message: 'Users found successfully',
        statusCode: 200,
        users: [mockUser],
        totalPages: 1,
        currentPage: 1,
        totalUsers: 2,
      });
    });

    it('should return an empty users array when no users are found', async () => {
      mockUserModel.countDocuments.mockResolvedValue(0);
      mockUserModel.find.mockReturnValue(mockUserModel);
      mockUserModel.limit.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await userService.getAllUsers(1, 10);

      expect(result).toEqual({
        message: 'Users found successfully',
        statusCode: 200,
        users: [],
        totalPages: 0,
        currentPage: 1,
        totalUsers: 0,
      });
    });
    it('should handle errors and return a proper response', async () => {
      const errorMessage = 'Database error';
      mockUserModel.countDocuments.mockRejectedValue(new Error(errorMessage));

      await expect(userService.getAllUsers(1, 10)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getUser', () => {
    it('should return a user with sorted issue history', async () => {
      const mockUserWithIssues = {
        ...mockUser,
        issueHistory: [
          { date: '2024-09-24', description: 'Issue 1' },
          { date: '2024-09-22', description: 'Issue 2' },
          { date: '2024-09-23', description: 'Issue 3' },
        ],
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserWithIssues),
      });

      const result = await userService.getUser('1', 1, 2);

      expect(result).toEqual({
        message: 'User found successfully',
        statusCode: 200,
        user: expect.objectContaining({
          accountId: '1',
          displayName: 'John Doe',
          issueHistory: [
            { date: '2024-09-24', description: 'Issue 1' },
            { date: '2024-09-23', description: 'Issue 3' },
          ],
          totalIssueHistory: 3,
          currentPage: 1,
          totalPages: 2,
        }),
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(userService.getUser('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete a user successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findOneAndDelete.mockResolvedValue(mockUser);

      const result = await userService.deleteUser('1');

      expect(result).toEqual({
        message: 'User deleted successfully',
        statusCode: 200,
      });
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
      expect(mockUserModel.findOneAndDelete).toHaveBeenCalledWith({
        accountId: '1',
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(userService.deleteUser('1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
      expect(mockUserModel.findOneAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('archiveUser', () => {
    it('should archive a user successfully', async () => {
      const mockUserInstance = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(mockUser),
      };
      mockUserModel.findOne.mockResolvedValue(mockUserInstance);

      const result = await userService.archiveUser('1');

      expect(result).toEqual({
        message: 'User archived successfully',
        statusCode: 200,
      });
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
      expect(mockUserInstance.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(userService.archiveUser('1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
    });

    it('should throw ConflictException if user is already archived', async () => {
      mockUserModel.findOne.mockResolvedValue({
        ...mockUser,
        isArchive: true,
      });

      await expect(userService.archiveUser('1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
    });
  });

  //   it('should fetch and save planned issues successfully', async () => {
  //     const date = '2024-09-24';
  //     const accountId = '1';
  //     const userWithIssues = {
  //       ...mockUser,
  //       issueHistory: [
  //         {
  //           date: '2024-09-24',
  //           notDoneIssues: [
  //             {
  //               issueType: 'Bug',
  //               issueId: 'bug-1',
  //               summary: 'Issue 1',
  //               status: 'Open',
  //               issueLinks: [{ issueId: 'link-1' }],
  //             },
  //           ],
  //         },
  //       ],
  //     };

  //     mockUserModel.findOne.mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(userWithIssues),
  //     });

  //     mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(mockUser);

  //     const result = await userService.fetchAndSavePlannedIssues(
  //       accountId,
  //       date,
  //     );

  //     expect(result).toEqual({
  //       statusCode: 200,
  //       message: 'Planned issues have been successfully updated.',
  //     });

  //     expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
  //       {
  //         userName: userWithIssues.displayName,
  //         accountId: userWithIssues.accountId,
  //       },
  //       {
  //         $set: {
  //           [`history.${new Date(date).toISOString().split('T')[0]}`]: {
  //             issues: [
  //               {
  //                 serialNumber: 1,
  //                 issueType: 'Bug',
  //                 issueId: 'bug-1',
  //                 issueSummary: 'Issue 1',
  //                 issueStatus: 'Open',
  //                 planned: true,
  //                 link: 'link-1',
  //               },
  //             ],
  //           },
  //         },
  //       },
  //       { upsert: true, new: true },
  //     );
  //   });

  //   it('should handle errors thrown during saving', async () => {
  //     const date = '2024-09-24';
  //     const accountId = '1';
  //     const userWithIssues = {
  //       ...mockUser,
  //       issueHistory: [
  //         {
  //           date: '2024-09-24',
  //           notDoneIssues: [
  //             {
  //               issueType: 'Bug',
  //               issueId: 'bug-1',
  //               summary: 'Issue 1',
  //               status: 'Open',
  //               issueLinks: [{ issueId: 'link-1' }],
  //             },
  //           ],
  //         },
  //       ],
  //     };

  //     mockUserModel.findOne.mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(userWithIssues),
  //     });

  //     mockIssueHistoryModel.findOneAndUpdate.mockRejectedValue(
  //       new Error('Database error'),
  //     );

  //     await expect(
  //       userService.fetchAndSavePlannedIssues(accountId, date),
  //     ).rejects.toThrow(InternalServerErrorException);
  //   });
  // });
  describe('fetchAndSavePlannedIssues', () => {
    const accountId = '1';
    const date = '2024-10-14';

    it('should successfully save planned issues', async () => {
      // Mock user with planned issues
      const mockUserWithIssues = {
        accountId: '1',
        displayName: 'John Doe',
        issueHistory: [
          {
            date: '2024-10-14',
            notDoneIssues: [
              {
                issueId: '1',
                issueType: 'bug',
                summary: 'Test bug',
                status: 'not done',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUserWithIssues),
      });

      const result = await userService.fetchAndSavePlannedIssues(
        accountId,
        date,
      );

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId });
      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          userName: mockUserWithIssues.displayName,
          accountId: mockUserWithIssues.accountId,
        },
        {
          $set: {
            [`history.${new Date(date).toISOString().split('T')[0]}`]: {
              issues: [
                {
                  serialNumber: 1,
                  issueType: 'bug',
                  issueId: '1',
                  issueSummary: 'Test bug',
                  issueStatus: 'not done',
                  planned: true,
                  link: 'link-1',
                },
              ],
            },
          },
        },
        { upsert: true, new: true },
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Planned issues have been successfully updated.',
      });
    });

    it('should handle errors thrown during fetching', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        userService.fetchAndSavePlannedIssues(accountId, date),
      ).rejects.toThrow(Error);
    });
  });

  describe('fetchAndSaveAllIssues', () => {
    const accountId = '1';
    const date = '2024-10-14';

    it('should successfully update existing issues and their statuses', async () => {
      const mockUser = {
        accountId: '1',
        displayName: 'John Doe',
        issueHistory: [
          {
            date: '2024-10-14',
            doneIssues: [
              {
                issueId: '1',
                issueType: 'bug',
                summary: 'Test bug',
                status: 'done',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      const mockIssueHistory = {
        history: {
          '2024-10-14': {
            issues: [
              {
                issueId: '1',
                issueStatus: 'in-progress',
                link: '',
              },
              {
                issueId: '2',
                issueStatus: 'in-progress',
                link: '',
              },
            ],
          },
        },
      };
      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      mockIssueHistoryModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockIssueHistory),
      });

      const result = await userService.fetchAndSaveAllIssues(accountId, date);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId });
      expect(mockIssueHistoryModel.findOne).toHaveBeenCalledWith({
        accountId: mockUser.accountId,
      });
      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userName: mockUser.displayName, accountId: mockUser.accountId },
        expect.objectContaining({
          $set: {
            [`history.${date}`]: {
              issues: [
                {
                  issueId: '1',
                  issueStatus: 'done',
                  link: 'link-1',
                },
                {
                  issueId: '2',
                  issueStatus: 'in-progress',
                  link: '',
                },
              ],
            },
          },
        }),
        { upsert: true, new: true },
      );
      expect(result).toEqual({
        statusCode: 200,
        message: 'Issues have been successfully updated.',
      });
    });

    it('should add new done issues to the specific date history', async () => {
      const mockUser = {
        accountId: '1',
        displayName: 'John Doe',
        issueHistory: [
          {
            date: '2024-10-14',
            doneIssues: [
              {
                issueId: '3',
                issueType: 'feature',
                summary: 'New feature',
                status: 'done',
                issueLinks: [{ issueId: 'link-2' }],
              },
            ],
          },
        ],
      };

      const mockIssueHistory = {
        history: {
          '2024-10-14': {
            issues: [],
          },
        },
      };

      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      mockIssueHistoryModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockIssueHistory),
      });

      const result = await userService.fetchAndSaveAllIssues(accountId, date);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId });
      expect(mockIssueHistoryModel.findOne).toHaveBeenCalledWith({
        accountId: mockUser.accountId,
      });
      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userName: mockUser.displayName, accountId: mockUser.accountId },
        expect.objectContaining({
          $set: {
            [`history.${date}`]: {
              issues: [
                expect.objectContaining({
                  issueId: '3',
                  issueStatus: 'done',
                  link: 'link-2',
                }),
              ],
            },
          },
        }),
        { upsert: true, new: true },
      );
      expect(result).toEqual({
        statusCode: 200,
        message: 'Issues have been successfully updated.',
      });
    });

    it('should handle errors thrown during fetching', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        userService.fetchAndSaveAllIssues(accountId, date),
      ).rejects.toThrow(Error);
    });
  });

  describe('getIssuesByDate', () => {
    it('should return issues for the given date', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      const mockResult = {
        userName: 'John Doe',
        accountId: accountId,
        history: {
          [date]: {
            issues: [
              { issueId: 'bug-1', issueSummary: 'Bug 1' },
              { issueId: 'bug-2', issueSummary: 'Bug 2' },
            ],
            noOfBugs: 2,
            comment: 'All bugs are logged.',
            comments: [],
          },
        },
      };

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult),
      });

      const response = await userService.getIssuesByDate(accountId, date);

      expect(response).toEqual({
        userName: mockResult.userName,
        accountId: mockResult.accountId,
        issues: mockResult.history[date].issues,
        noOfBugs: mockResult.history[date].noOfBugs,
        comment: mockResult.history[date].comment,
        comments: mockResult.history[date].comments || [],
      });
    });

    it('should return empty issues when no history exists for the date', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      const mockResult = {
        userName: 'John Doe',
        accountId: accountId,
        history: {},
      };

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult),
      });

      const response = await userService.getIssuesByDate(accountId, date);

      expect(response).toEqual({
        userName: mockResult.userName,
        accountId: mockResult.accountId,
        issues: [],
        noOfBugs: 0,
        comment: '',
        comments: [],
      });
    });

    it('should handle errors thrown during fetching', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        userService.getIssuesByDate(accountId, date),
      ).rejects.toThrow(Error);
    });

    it('should sort comments by timestamp in descending order', async () => {
      const accountId = '1';
      const date = '2024-09-24';

      const mockResult = {
        userName: 'John Doe',
        accountId: accountId,
        history: {
          [date]: {
            issues: [],
            noOfBugs: 0,
            comment: '',
            comments: [
              {
                timestamp: new Date('2024-09-24T12:00:00Z'),
                text: 'Comment 1',
              },
              {
                timestamp: new Date('2024-09-24T14:00:00Z'),
                text: 'Comment 2',
              },
              {
                timestamp: new Date('2024-09-24T13:00:00Z'),
                text: 'Comment 3',
              },
            ],
          },
        },
      };

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult),
      });

      const response = await userService.getIssuesByDate(accountId, date);

      expect(response.comments).toEqual([
        { timestamp: new Date('2024-09-24T14:00:00Z'), text: 'Comment 2' },
        { timestamp: new Date('2024-09-24T13:00:00Z'), text: 'Comment 3' },
        { timestamp: new Date('2024-09-24T12:00:00Z'), text: 'Comment 1' },
      ]);
    });
  });

  describe('bugReportByDate', () => {
    it('should update bug report successfully', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const noOfBugs = 3;
      const comment = 'Updated comment';
      const token = 'valid-token';

      jest.spyOn(configService, 'get').mockReturnValue(token);

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUser.save.mockResolvedValue(mockUser);
      const updatedIssue = {
        accountId,
        history: {
          [date]: {
            noOfBugs,
            comment,
          },
        },
      };

      mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(updatedIssue);

      const result = await userService.bugReportByDate(
        accountId,
        date,
        noOfBugs,
        comment,
        token,
      );

      expect(result).toEqual({
        message: 'Bug report updated successfully',
        statusCode: 200,
      });
    });

    it('should throw ForbiddenException for invalid token', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const noOfBugs = 3;
      const comment = 'Updated comment';
      const token = 'invalid-token';

      await expect(
        userService.bugReportByDate(accountId, date, noOfBugs, comment, token),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user is not found', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const noOfBugs = 3;
      const comment = 'Updated comment';
      const token = 'valid-token';

      jest.spyOn(configService, 'get').mockReturnValue(token);
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(
        userService.bugReportByDate(accountId, date, noOfBugs, comment, token),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no issue history is found for the date', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const noOfBugs = 3;
      const comment = 'Updated comment';
      const token = 'valid-token';

      jest.spyOn(configService, 'get').mockReturnValue(token);
      mockUserModel.findOne.mockResolvedValue({
        ...mockUser,
        issueHistory: [{ date: '2024-09-25' }],
      });

      await expect(
        userService.bugReportByDate(accountId, date, noOfBugs, comment, token),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createComment', () => {
    it('should successfully add a comment to the issue history', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const comment = 'This is a test comment.';

      const mockUser = {
        accountId: accountId,
        displayName: 'John Doe',
      };

      const mockIssueHistory = {
        accountId: accountId,
        history: {
          [date]: {
            comments: [],
          },
        },
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIssueHistory),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(
        mockIssueHistory,
      );

      const response = await userService.createComment(
        accountId,
        date,
        comment,
      );

      expect(response).toEqual({
        message: 'Comment added successfully',
        statusCode: 200,
      });

      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { accountId, [`history.${date}`]: { $exists: true } },
        {
          $push: {
            [`history.${date}.comments`]: {
              comment,
              timestamp: expect.any(Date),
            },
          },
        },
        { new: true },
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const comment = 'This is a test comment.';

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        userService.createComment(accountId, date, comment),
      ).rejects.toThrow(NotFoundException);
      await expect(
        userService.createComment(accountId, date, comment),
      ).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException if issue history for the date does not exist', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const comment = 'This is a test comment.';

      const mockUser = {
        accountId: accountId,
        displayName: 'John Doe',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        userService.createComment(accountId, date, comment),
      ).rejects.toThrow(NotFoundException);
      await expect(
        userService.createComment(accountId, date, comment),
      ).rejects.toThrow('Issue history for the specified date not found');
    });

    it('should handle errors thrown during comment creation', async () => {
      const accountId = '1';
      const date = '2024-09-24';
      const comment = 'This is a test comment.';

      const mockUser = {
        accountId: accountId,
        displayName: 'John Doe',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          accountId,
          history: {
            [date]: {
              comments: [],
            },
          },
        }),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        userService.createComment(accountId, date, comment),
      ).rejects.toThrow(Error);
    });
  });
});
