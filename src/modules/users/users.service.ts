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

  async fetchAndSavePlannedIssues(
    accountId: string,
    date: string,
  ): Promise<{ status: number; message: string }> {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

      //Check for issue history for the given date
      const notDoneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.notDoneIssues || [];

      //Prepare the new issue entries
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

      return {
        status: 200,
        message: `Planned issues have been successfully updated.`,
      };
    } catch (error) {
      throw error;
    }
  }

  async fetchAndSaveAllIssues(
    accountId: string,
    date: string,
  ): Promise<{ status: number; message: string }> {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

      //Fetch the user's issue history or create a new one if it doesn't exist
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

      // Get the specific date history or create a new entry if it doesn't exist
      const specificDateHistory = issueHistory.history[dateString] || {
        issues: [],
      };

      // Get the done issues for the user on the specified date
      const doneIssues =
        user.issueHistory.find((history) => history.date === dateString)
          ?.doneIssues || [];

      // Create a set of done issue IDs for quick lookup
      const doneIssueIds = new Set(doneIssues.map((issue) => issue.issueId));

      // Create a set of not done issue IDs for comparison
      const notDoneIssueIds = new Set(
        specificDateHistory.issues.map((issue) => issue.issueId),
      );

      // Update the status of "not done" issues that are now done
      specificDateHistory.issues = specificDateHistory.issues.map((issue) => {
        if (doneIssueIds.has(issue.issueId)) {
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

      //Prepare new done issues that are not already in today's not done issues
      const newDoneIssueEntries = doneIssues
        .filter((issue) => !notDoneIssueIds.has(issue.issueId))
        .map((issue, index) => {
          const linkedIssueIdsSet = new Set<string>();
          issue.issueLinks?.forEach((link) =>
            linkedIssueIdsSet.add(link.issueId),
          );

          return {
            serialNumber: specificDateHistory.issues.length + index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueSummary: issue.summary,
            issueStatus: issue.status,
            link: Array.from(linkedIssueIdsSet).join(','),
          };
        });

      // Add the new done issues to the history for the specified date
      specificDateHistory.issues.push(...newDoneIssueEntries);
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
        { $set: { [`history.${dateString}`]: specificDateHistory } },
        { upsert: true, new: true },
      );

      return {
        status: 200,
        message: `Issues have been successfully updated`,
      };
    } catch (error) {
      throw error;
    }
  }

  async getIssuesByDate(accountId: string, date: string) {
    const historyPath = `history.${date}`;

    try {
      const result = await this.issueHistoryModel
        .findOne(
          { accountId, [historyPath]: { $exists: true, $ne: null } },
          { userName: 1, accountId: 1, [historyPath]: 1 },
        )
        .exec();

      if (!result || !result.history[date]?.issues) {
        return {
          userName: result?.userName,
          accountId: result?.accountId,
          issues: [],
        };
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
      const envToken = this.configService.get<string>('REPORT_BUG_TOKEN');
      if (!token || token !== envToken) {
        throw new ForbiddenException({
          status: 403,
          errorCode: 'invalid_token',
          message: 'Invalid or missing token',
          data: {},
        });
      }

      const user = await this.userModel.findOne({ accountId });
      if (!user) {
        throw new NotFoundException({
          status: 404,
          errorCode: 'user_not_found',
          message: `User not found`,
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
          message: `No issue history found`,
          data: {},
        });
      }

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
