import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import {
  IGetIssuesByDateResponse,
  IUserResponse,
  IUserWithPagination,
} from '../../common/interfaces/jira.interfaces';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { ConfigService } from '@nestjs/config';
import { handleError } from '../../common/helpers/error.helper';
import {
  validateAccountId,
  validateDate,
  validatePagination,
} from '../../common/helpers/validation.helper';

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
      validatePagination(page, limit);

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
      throw handleError(error);
    }
  }

  async getUser(
    accountId: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<IUserResponse> {
    try {
      validateAccountId(accountId);
      validatePagination(page, limit);

      const user = await this.userModel.findOne({ accountId }).exec();

      if (!user) {
        throw new NotFoundException('User not found');
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
      throw handleError(error);
    }
  }

  async deleteUser(accountId: string): Promise<IUserResponse> {
    try {
      validateAccountId(accountId);

      const existingUser = await this.userModel.findOne({ accountId });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      await this.userModel.findOneAndDelete({ accountId });

      return {
        message: 'User deleted successfully',
        statusCode: 200,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  async archiveUser(
    accountId: string,
  ): Promise<{ message: string; statusCode: number }> {
    try {
      validateAccountId(accountId);

      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new NotFoundException('User with accountId not found');
      }

      if (user.isArchive) {
        throw new ConflictException('User is already archived');
      }

      user.isArchive = true;
      await user.save();

      return {
        message: 'User archived successfully',
        statusCode: 200,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  async fetchAndSavePlannedIssues(
    accountId: string,
    date: string,
  ): Promise<{ status: number; message: string }> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

      // Check for issue history for the given date
      const notDoneIssues =
        user.issueHistory.find((history) => {
          return history.date === dateString;
        })?.notDoneIssues || [];

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
        message: 'Planned issues have been successfully updated.',
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  async fetchAndSaveAllIssues(
    accountId: string,
    date: string,
  ): Promise<{ status: number; message: string }> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

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
          const matchedDoneIssue = doneIssues.find((done) => {
            return done.issueId === issue.issueId;
          });

          // Update the issue status and linked issue IDs
          const linkedIssueIdsSet = new Set<string>();
          matchedDoneIssue?.issueLinks?.forEach((link) => {
            linkedIssueIdsSet.add(link.issueId);
          });

          return {
            ...issue,
            issueStatus: matchedDoneIssue?.status || issue.issueStatus,
            link: Array.from(linkedIssueIdsSet).join(','),
          };
        }
        return issue;
      });

      // Prepare new done issues that are not already in today's not done issues
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
        message: 'Issues have been successfully updated.',
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  async getIssuesByDate(
    accountId: string,
    date: string,
  ): Promise<IGetIssuesByDateResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const historyPath = `history.${date}`;

      const result = await this.issueHistoryModel
        .findOne(
          { accountId, [historyPath]: { $exists: true, $ne: null } },
          { userName: 1, accountId: 1, [historyPath]: 1 },
        )
        .exec();

      if (!result || !result.history[date]) {
        return {
          userName: result?.userName,
          accountId: result?.accountId,
          issues: [],
          noOfBugs: 0,
          comment: '',
        };
      }

      const { issues, noOfBugs, comment } = result.history[date];

      return {
        userName: result.userName,
        accountId: result.accountId,
        issues,
        noOfBugs,
        comment,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  async bugReportByDate(
    accountId: string,
    date: string,
    noOfBugs: number,
    comment: string,
    token: string,
  ): Promise<{ message: string; statusCode: number }> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      // Validate token
      const envToken = this.configService.get<string>('REPORT_BUG_TOKEN');
      if (!token || token !== envToken) {
        throw new ForbiddenException('Invalid or missing token');
      }

      // Validate noOfBugs
      if (noOfBugs === undefined || noOfBugs === null) {
        throw new BadRequestException('Number of bugs is required');
      }

      const user = await this.userModel.findOne({ accountId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userIssueEntry = user.issueHistory.find(
        (entry) => entry.date === date,
      );
      if (userIssueEntry) {
        userIssueEntry.reportBug = { noOfBugs, comment };
        await user.save();
      } else {
        throw new NotFoundException('No issue history found');
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
      throw handleError(error);
    }
  }
}
