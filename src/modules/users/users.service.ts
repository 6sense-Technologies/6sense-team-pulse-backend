import {
  ConflictException,
  Injectable,
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
  ) {
    //Nothing
  }

  async getAllUsers(
    page = 1,
    limit = 10,
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
    page = 1,
    limit = 10,
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
        .sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })
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
    const dateString = new Date().toISOString().split('T')[0];

    for (const user of users) {
      // Get the not done issues for the user
      const notDoneIssues =
        user.issueHistory.find((history) => {
          return history.date === dateString;
        })?.notDoneIssues || [];

      // Prepare the new issue entries
      const issueHistoryEntries = notDoneIssues.map((issue, index) => {
        return {
          serialNumber: index + 1, // You can adjust this logic if needed
          issueType: issue.issueType,
          issueId: issue.issueId,
          issueSummary: issue.summary,
          issueStatus: issue.status,
          planned: true,
          link: issue.issueLinks
            ? issue.issueLinks
                .map((link) => {
                  return link.issueId;
                })
                .join(',')
            : '', // Adjusted to store linked issue IDs
        };
      });

      // Update or create the issue history document for the user
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName },
        {
          $set: {
            [`history.${dateString}`]: {
              issues: issueHistoryEntries,
            },
          },
        },
        { upsert: true, new: true },
      );
    }

    return 'Not Done issues saved for all users';
  }

  async fetchAndSaveDoneIssuesForAllUsers() {
    const users = await this.userModel.find().exec();
    const dateString = new Date().toISOString().split('T')[0]; // Get the current date in "YYYY-MM-DD" format
  
    for (const user of users) {
      let issueHistory = await this.issueHistoryModel.findOne({ userName: user.displayName }).exec();
  
      if (!issueHistory) {
        issueHistory = new this.issueHistoryModel({
          userName: user.displayName,
          accountId: user.accountId,
          history: {},
        });
      }
  
      // Get today's history or create a new entry if it doesn't exist
      const todayHistory = issueHistory.history[dateString] || { issues: [] };
  
      // Get the done issues for the user on the current date
      const doneIssues = user.issueHistory.find(history => history.date === dateString)?.doneIssues || [];
  
      // Create a set of done issue IDs for quick lookup
      const doneIssueIds = new Set(doneIssues.map(issue => issue.issueId));
  
      // Create a set of not done issue IDs for comparison
      const notDoneIssueIds = new Set(todayHistory.issues.map(issue => issue.issueId));
  
      // Update the status and issue links of "not done" issues that are in the done issues list
      todayHistory.issues = todayHistory.issues.map(issue => {
        if (doneIssueIds.has(issue.issueId)) {
          // Find the matching done issue
          const matchedDoneIssue = doneIssues.find(done => done.issueId === issue.issueId);
  
          // Update the issue status and linked issue IDs
          const linkedIssueIdsSet = new Set<string>();
          if (matchedDoneIssue?.issueLinks) {
            matchedDoneIssue.issueLinks.forEach(link => linkedIssueIdsSet.add(link.issueId));
          }
  
          return {
            ...issue,
            issueStatus: matchedDoneIssue?.status || issue.issueStatus, // Update to the new done status
            link: Array.from(linkedIssueIdsSet).join(','), // Update linked issue IDs
          };
        }
        return issue; // Keep the issue as is if it's not done
      });
  
      // Prepare the new done issues that are **not already in the not done issues**
      const newDoneIssueEntries = doneIssues
        .filter(issue => !notDoneIssueIds.has(issue.issueId)) // Only add issues not already in today's not done issues
        .map((issue, index) => {
          // If the issue has linked issues, add them to the set
          const linkedIssueIdsSet = new Set<string>();
          if (issue.issueLinks) {
            issue.issueLinks.forEach(link => linkedIssueIdsSet.add(link.issueId));
          }
  
          return {
            serialNumber: todayHistory.issues.length + index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueSummary: issue.summary,
            issueStatus: issue.status, // Status of the new done issue
            link: Array.from(linkedIssueIdsSet).join(','), // Store linked issue IDs as a comma-separated string
          };
        });
  
      // Add the new done issues to today's history
      todayHistory.issues.push(...newDoneIssueEntries);
  
      // Update the issue history document with the updated and new entries
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName },
        {
          $set: { [`history.${dateString}`]: todayHistory },
        },
        { upsert: true, new: true },
      );
    }
  
    return 'Done issues saved and status updated for not done issues with issue links added where applicable';
  }
  
  
  async getIssuesByAccountAndDate(accountId: string, date: string) {
    const historyPath = `history.${date}`;

    try {
      const result = await this.issueHistoryModel
        .findOne(
          { accountId, [historyPath]: { $exists: true } },
          { userName: 1, accountId: 1, [historyPath]: 1 },
        )
        .exec();

      if (
        !result ||
        !result.history[date] ||
        !result.history[date].issues ||
        result.history[date].issues.length === 0
      ) {
        throw new NotFoundException(`No issues found on date: ${date}`);
      }

      return {
        userName: result.userName,
        accountId: result.accountId,
        issues: result.history[date].issues,
      };
    } catch (error) {
      throw error;
    }
  }
}
