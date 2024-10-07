import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import {
  IUserResponse,
  IUserWithPagination,
} from '../../common/interfaces/jira.interfaces';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(IssueHistory.name)
    private readonly issueHistoryModel: Model<IssueHistory>,
    private readonly configService: ConfigService,
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

  async fetchAndSaveNotDoneIssuesForAllUsers(): Promise<void> {
    const users = await this.userModel.find().exec();

    //Step 1: Get the date string for the current day in 'YYYY-MM-DD' format
    const Day = new Date();
    Day.setDate(Day.getDate());
    const dateString = Day.toISOString().split('T')[0];

    // Step 2: Get the not done issues for the user on the current date
    for (const user of users) {
      const notDoneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.notDoneIssues || [];

      // Step 3: Prepare the new issue entries
      const issueHistoryEntries = notDoneIssues.map((issue, index) => ({
        serialNumber: index + 1,
        issueType: issue.issueType,
        issueId: issue.issueId,
        issueSummary: issue.summary,
        issueStatus: issue.status,
        planned: true,
        link: issue.issueLinks
          ? issue.issueLinks.map((link) => link.issueId).join(',')
          : '',
      }));

      // Step 4: Update or create the issue history document for the user
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
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
  }

  async fetchAndSaveDoneIssuesForAllUsers(): Promise<void> {
    const users = await this.userModel.find().exec();

    // Step 1: Get the date string for the previous day in 'YYYY-MM-DD' format
    const Day = new Date();
    Day.setDate(Day.getDate() - 3);
    const dateString = Day.toISOString().split('T')[0];

    for (const user of users) {
      // Fetch the user's issue history or create a new one if it doesn't exist
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

      // Get today's history or create a new entry if it doesn't exist
      const todayHistory = issueHistory.history[dateString] || { issues: [] };

      // Get the done issues for the user on current day
      const doneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.doneIssues || [];

      // Create a set of done issue IDs for quick lookup
      const doneIssueIds = new Set(doneIssues.map((issue) => issue.issueId));

      // Create a set of not done issue IDs for comparison
      const notDoneIssueIds = new Set(
        todayHistory.issues.map((issue) => issue.issueId),
      );

      // Step 2: Update the status of "not done" issues that are now done
      todayHistory.issues = todayHistory.issues.map((issue) => {
        if (doneIssueIds.has(issue.issueId)) {
          // Find the matching done issue
          const matchedDoneIssue = doneIssues.find(
            (done) => done.issueId === issue.issueId,
          );

          // Update the issue status and linked issue IDs
          const linkedIssueIdsSet = new Set<string>();
          matchedDoneIssue?.issueLinks?.forEach((link) =>
            linkedIssueIdsSet.add(link.issueId),
          );

          return {
            ...issue,
            issueStatus: matchedDoneIssue?.status || issue.issueStatus,
            link: Array.from(linkedIssueIdsSet).join(','),
          };
        }
        return issue;
      });

      // Step 3: Prepare new done issues that are not already in today's not done issues
      const newDoneIssueEntries = doneIssues
        .filter((issue) => !notDoneIssueIds.has(issue.issueId))
        .map((issue, index) => {
          const linkedIssueIdsSet = new Set<string>();
          issue.issueLinks?.forEach((link) =>
            linkedIssueIdsSet.add(link.issueId),
          );

          return {
            serialNumber: todayHistory.issues.length + index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueSummary: issue.summary,
            issueStatus: issue.status,
            link: Array.from(linkedIssueIdsSet).join(','),
          };
        });

      // Add the new done issues to today's history
      todayHistory.issues.push(...newDoneIssueEntries);

      // Step 4: Update the issue history document with the updated and new entries
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
        { $set: { [`history.${dateString}`]: todayHistory } },
        { upsert: true, new: true },
      );
    }
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

  async reportBug(
    accountId: string,
    date: string,
    noOfBugs: number,
    comment: string,
    token: string,
  ): Promise<{ message: string; statusCode: number }> {
    try {
      // 1. Validate token
      const envToken = this.configService.get<string>('REPORT_BUG_TOKEN');
      if (!token || token !== envToken) {
        throw new ForbiddenException({
          status: 403,
          errorCode: 'invalid_token',
          message: 'Invalid or missing token',
          data: {},
        });
      }

      // 2. Fetch user and update issueHistory in User model
      const user = await this.userModel.findOne({ accountId });
      if (!user) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'user_not_found',
          message: `User with accountId: ${accountId} not found`,
          data: {},
        });
      }

      const userIssueEntry = user.issueHistory.find(
        (entry) => entry.date === date,
      );
      if (userIssueEntry) {
        userIssueEntry.reportBug = { noOfBugs, comment };
        await user.save();
      } else {
        throw new NotFoundException({
          status: 404,
          errorCode: 'issue_history_not_found',
          message: `No issue history found for date: ${date}`,
          data: {},
        });
      }

      // 3. Upsert the reportBug in the IssueHistory model
      await this.issueHistoryModel.findOneAndUpdate(
        { accountId, [`history.${date}`]: { $exists: true } },
        {
          $set: {
            [`history.${date}.noOfBugs`]: noOfBugs,
            [`history.${date}.comment`]: comment,
          },
        },
        { upsert: true, new: true },
      );

      return {
        message: 'Bug report updated successfully',
        statusCode: 200,
      };
    } catch (error) {
      throw error;
    }
  }
}
