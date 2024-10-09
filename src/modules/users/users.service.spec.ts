import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { ConfigService } from '@nestjs/config';

const mockUser = {
  accountId: '1',
  displayName: 'John Doe',
  emailAddress: 'john@example.com',
  avatarUrls: 'http://example.com/avatar.png',
  currentPerformance: 0,
  designation: 'Frontend Developer',
  isArchive: false,
  issueHistory: [],
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({
    accountId: '1',
    displayName: 'John Doe',
    emailAddress: 'john@example.com',
    avatarUrls: 'http://example.com/avatar.png',
    currentPerformance: 0,
    designation: 'Frontend Developer',
    isArchive: false,
    issueHistory: [],
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

describe('UserService', () => {
  let userService: UserService;
  let userModel: Model<User>;
  let issueHistory: Model<IssueHistory>;
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
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
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

    it('should handle errors and throw an InternalServerErrorException', async () => {
      const errorMessage = 'Database error';
      mockUserModel.countDocuments.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(userService.getAllUsers(1, 10)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(userService.getAllUsers(1, 10)).rejects.toThrow(
        errorMessage,
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

    it('should handle errors and return an InternalServerErrorException', async () => {
      const errorMessage = 'Database error';
      mockUserModel.findOne.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(userService.getUser('1')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(userService.getUser('1')).rejects.toThrow(errorMessage);
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

    it('should handle errors and return an InternalServerErrorException', async () => {
      const errorMessage = 'Database error';
      mockUserModel.findOne.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(userService.deleteUser('1')).rejects.toThrow(
        new Error(errorMessage),
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
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

    it('should handle errors and return an InternalServerErrorException', async () => {
      const errorMessage = 'Database error';
      mockUserModel.findOne.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(userService.archiveUser('1')).rejects.toThrow(
        new Error(errorMessage),
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId: '1' });
    });
  });

  describe('fetchAndSavePlannedIssues', () => {
    it('should fetch and save planned issues successfully', async () => {
      const date = '2024-09-24';
      const accountId = '1';
      const userWithIssues = {
        ...mockUser,
        issueHistory: [
          {
            date: '2024-09-24',
            notDoneIssues: [
              {
                issueType: 'Bug',
                issueId: 'bug-1',
                summary: 'Issue 1',
                status: 'Open',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userWithIssues),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result = await userService.fetchAndSavePlannedIssues(
        accountId,
        date,
      );

      expect(result).toEqual({
        status: 200,
        message: 'Planned issues have been successfully updated.',
      });

      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          userName: userWithIssues.displayName,
          accountId: userWithIssues.accountId,
        },
        {
          $set: {
            [`history.${new Date(date).toISOString().split('T')[0]}`]: {
              issues: [
                {
                  serialNumber: 1,
                  issueType: 'Bug',
                  issueId: 'bug-1',
                  issueSummary: 'Issue 1',
                  issueStatus: 'Open',
                  planned: true,
                  link: 'link-1',
                },
              ],
            },
          },
        },
        { upsert: true, new: true },
      );
    });

    it('should handle errors thrown during saving', async () => {
      const date = '2024-09-24';
      const accountId = '1';
      const userWithIssues = {
        ...mockUser,
        issueHistory: [
          {
            date: '2024-09-24',
            notDoneIssues: [
              {
                issueType: 'Bug',
                issueId: 'bug-1',
                summary: 'Issue 1',
                status: 'Open',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userWithIssues),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        userService.fetchAndSavePlannedIssues(accountId, date),
      ).rejects.toThrow(new Error('Database error'));
    });
  });

  describe('fetchAndSaveAllIssues', () => {
    it('should fetch and save all issues successfully', async () => {
      const date = '2024-09-24';
      const accountId = '1';
      const userWithIssues = {
        ...mockUser,
        issueHistory: [
          {
            date: '2024-09-24',
            doneIssues: [
              {
                issueType: 'Bug',
                issueId: 'bug-1',
                summary: 'Issue 1',
                status: 'Closed',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      const existingIssueHistory = {
        userName: userWithIssues.displayName,
        accountId: userWithIssues.accountId,
        history: {
          [new Date(date).toISOString().split('T')[0]]: {
            issues: [
              {
                issueId: 'bug-2',
                issueStatus: 'Open',
                link: 'link-2',
              },
            ],
          },
        },
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userWithIssues),
      });

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingIssueHistory),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(
        existingIssueHistory,
      );

      const result = await userService.fetchAndSaveAllIssues(accountId, date);

      expect(result).toEqual({
        status: 200,
        message: 'Issues have been successfully updated',
      });

      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          userName: userWithIssues.displayName,
          accountId: userWithIssues.accountId,
        },
        {
          $set: {
            [`history.${new Date(date).toISOString().split('T')[0]}`]: {
              issues: [
                {
                  issueId: 'bug-2',
                  issueStatus: 'Open',
                  link: 'link-2',
                },
                {
                  serialNumber: 2,
                  issueType: 'Bug',
                  issueId: 'bug-1',
                  issueSummary: 'Issue 1',
                  issueStatus: 'Closed',
                  link: 'link-1',
                },
              ],
            },
          },
        },
        { upsert: true, new: true },
      );
    });

    it('should handle errors thrown during saving', async () => {
      const date = '2024-09-24';
      const accountId = '1';
      const userWithIssues = {
        ...mockUser,
        issueHistory: [
          {
            date: '2024-09-24',
            doneIssues: [
              {
                issueType: 'Bug',
                issueId: 'bug-1',
                summary: 'Issue 1',
                status: 'Closed',
                issueLinks: [{ issueId: 'link-1' }],
              },
            ],
          },
        ],
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userWithIssues),
      });

      mockIssueHistoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockIssueHistoryModel.findOneAndUpdate.mockRejectedValue(
        new Error('Database error'),
      );

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
  });

  describe('bugReportByDate', () => {
    const accountId = '1';
    const date = '2024-10-08';
    const noOfBugs = 5;
    const comment = 'Bug description';
    const token = 'valid-token';

    const mockUser = {
      accountId: '1',
      displayName: 'John Doe',
      emailAddress: 'john@example.com',
      avatarUrls: 'http://example.com/avatar.png',
      currentPerformance: 0,
      designation: 'Frontend Developer',
      isArchive: false,
      issueHistory: [],
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({
        accountId: '1',
        displayName: 'John Doe',
        emailAddress: 'john@example.com',
        avatarUrls: 'http://example.com/avatar.png',
        currentPerformance: 0,
        designation: 'Frontend Developer',
        isArchive: false,
        issueHistory: [{ date, reportBug: null }],
      }),
    };

    it('should update the bug report successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);
      jest.spyOn(configService, 'get').mockReturnValue(token);

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
      expect(mockUser.issueHistory[0].reportBug).toEqual({ noOfBugs, comment });
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ accountId });
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { accountId, [`history.${date}`]: { $exists: true } },
        {
          $set: {
            [`history.${date}.noOfBugs`]: noOfBugs,
            [`history.${date}.comment`]: comment,
          },
        },
        { upsert: true, new: true },
      );
    });
  });
});
