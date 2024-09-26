import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import {
  IUserResponse,
  IUserWithPagination,
} from '../../interfaces/jira.interfaces';
import { IssueHistory } from './schemas/IssueHistory.schems';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(IssueHistory.name)
    private readonly issueHistoryModel: Model<IssueHistory>,
  ) {}

  async getAllUsers(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    message: string;
    statusCode: number;
    users: User[];
    totalPages: number;
    currentPage: number;
    totalUsers: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      const totalUsers = await this.userModel.countDocuments({
        isArchive: false,
      });

      const users = await this.userModel
        .find(
          { isArchive: false },
          'accountId displayName emailAddress avatarUrls currentPerformance designation project',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (users.length === 0) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'users_not_found',
          message: 'No users found',
          data: {},
        });
      }

      const totalPages = Math.ceil(totalUsers / limit);

      return {
        message: 'Users found successfully',
        statusCode: 200,
        users,
        totalPages,
        currentPage: page,
        totalUsers,
      };
    } catch (error) {
      throw error;
    }
  }

  async getUser(
    accountId: string,
    page: number = 1,
    limit: number = 1,
  ): Promise<IUserResponse> {
    try {
      const user = await this.userModel.findOne({ accountId }).exec();

      if (!user) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'user_not_found',
          message: 'User not found',
          data: {},
        });
      }

      const skip = (page - 1) * limit;

      const totalIssueHistory = user.issueHistory.length;
      const sortedIssueHistory = user.issueHistory
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(skip, skip + limit);

      const totalPages = Math.ceil(totalIssueHistory / limit);

      const userWithPagination: IUserWithPagination = {
        ...user.toObject(),
        issueHistory: sortedIssueHistory,
        totalIssueHistory,
        currentPage: page,
        totalPages,
      };

      return {
        message: 'User found successfully',
        statusCode: 200,
        user: userWithPagination,
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(accountId: string): Promise<IUserResponse> {
    try {
      const existingUser = await this.userModel.findOne({ accountId });

      if (!existingUser) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'user_not_found',
          message: 'User not found',
          data: {},
        });
      }

      await this.userModel.findOneAndDelete({ accountId });

      return {
        message: 'User deleted successfully',
        statusCode: 200,
      };
    } catch (error) {
      throw error;
    }
  }

  async archiveUser(
    accountId: string,
  ): Promise<{ message: string; statusCode: number }> {
    try {
      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'user_not_found',
          message: 'User with accountId not found',
          data: {},
        });
      }

      if (user.isArchive) {
        throw new ConflictException({
          status: 409,
          errorCode: 'user_already_archived',
          message: 'User is already archived',
          data: {},
        });
      }

      user.isArchive = true;
      await user.save();

      return {
        message: 'User archived successfully',
        statusCode: 200,
      };
    } catch (error) {
      throw error;
    }
  }

  async fetchAndSaveNotDoneIssuesForAllUsers() {
    const users = await this.userModel.find().exec();

    // Get the current date in "YYYY-MM-DD" format
    const dateString = new Date().toISOString().split('T')[0]; // "2024-09-26"

    for (const user of users) {
      // Find or create a new issue history for the user
      let issueHistory = await this.issueHistoryModel
        .findOne({ userName: user.displayName })
        .exec();
      if (!issueHistory) {
        issueHistory = new this.issueHistoryModel({
          userName: user.displayName,
          accountId: user.accountId,
          history: {},
        });
      }

      // Check if history for the current date already exists
      const todayHistory = issueHistory.history[dateString] || { issues: [] };

      const notDoneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.notDoneIssues || [];

      const issueHistoryEntries = notDoneIssues.map((issue, index) => ({
        serialNumber: todayHistory.issues.length + index + 1,
        issueType: issue.issueType,
        issueId: issue.issueId,
        issueStatus: issue.status,
        planned: true,
        issueSummary: issue.summary,
      }));

      // Add the new issues to today's history
      todayHistory.issues.push(...issueHistoryEntries);

      // Update the history for the date
      issueHistory.history[dateString] = todayHistory;

      // Save the updated issue history
      await issueHistory.save();
    }

    return 'Not Done issues saved for all users';
  }

  async fetchAndSaveDoneIssuesForAllUsers() {
    const users = await this.userModel.find().exec();

    // Get the current date in "YYYY-MM-DD" format
    const dateString = new Date().toISOString().split('T')[0]; // "2024-09-26"

    for (const user of users) {
      // Find or create a new issue history for the user
      let issueHistory = await this.issueHistoryModel
        .findOne({ userName: user.displayName })
        .exec();

      if (!issueHistory) {
        issueHistory = new this.issueHistoryModel({
          userName: user.displayName,
          accountId: user.accountId,
          history: {},
        });
      }

      // Check if history for the current date already exists
      const todayHistory = issueHistory.history[dateString] || { issues: [] };

      const doneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.doneIssues || [];

      // Create a set of not done issue IDs for quick lookup
      const notDoneIssueIds = new Set(
        (todayHistory.issues || []).map((issue) => issue.issueId),
      );

      // Filter for new done issues that are not in the not done issues
      const newDoneIssues = doneIssues.filter(
        (issue) => !notDoneIssueIds.has(issue.issueId),
      );

      // Create new issue entries for today's history
      const issueHistoryEntries = newDoneIssues.map((issue, index) => ({
        serialNumber: todayHistory.issues.length + index + 1,
        issueType: issue.issueType,
        issueId: issue.issueId,
        issueSummary: issue.summary,
        issueStatus: issue.status,
      }));

      // Add the new issues to today's history
      todayHistory.issues.push(...issueHistoryEntries);

      // Update the history for the date
      issueHistory.history[dateString] = todayHistory;

      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName },
        {
          $set: {
            history: issueHistory.history,
          },
        },
        { upsert: true, new: true },
      );
    }

    return 'Done issues saved for all users';
  }

  async getIssuesByAccountAndDate(accountId: string, date: string) {
    const historyPath = `history.${date}`;

    return this.issueHistoryModel
      .findOne(
        { accountId, [historyPath]: { $exists: true } },
        { [historyPath]: 1 },
      ) 
      .exec();
  }
}
