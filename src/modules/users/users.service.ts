import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ISuccessResponse } from '../../common/interfaces/jira.interfaces';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { IssueEntry } from './schemas/IssueEntry.schema';
import { ConfigService } from '@nestjs/config';
import { handleError } from '../../common/helpers/error.helper';
import {
  validateAccountId,
  validateDate,
  validatePagination,
} from '../../common/helpers/validation.helper';
import {
  IAllUsers,
  IUserResponse,
  IUserIssuesByDate,
  IUserWithPagination,
} from './interfaces/users.interfaces';
// import { Comment } from './schemas/Comment.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(IssueHistory.name)
    private readonly issueHistoryModel: Model<IssueHistory>,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
    // @InjectModel(Comment.name)
    // private readonly commentModel: Model<Comment>,
    private readonly configService: ConfigService,
  ) {
    //Nothing
  }

  async getAllUsers(page = 1, limit = 10): Promise<IAllUsers> {
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
      handleError(error);
    }
  }

  async getUser(
    accountId: string,
    page = 1,
    limit = 30,
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
      handleError(error);
    }
  }

  async deleteUser(accountId: string): Promise<ISuccessResponse> {
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
      handleError(error);
    }
  }

  async archiveUser(accountId: string): Promise<ISuccessResponse> {
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
      handleError(error);
    }
  }

  async fetchAndSavePlannedIssues(
    accountId: string,
    date: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

      const notDoneIssues =
        user.issueHistory.find((history) => {
          return history.date === dateString;
        })?.notDoneIssues || [];

      const issueHistoryEntries = notDoneIssues.map((issue, index) => {
        return {
          serialNumber: index + 1,
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
            : '',
        };
      });

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
        statusCode: 200,
        message: 'Planned issues have been successfully updated.',
      };
    } catch (error) {
      handleError(error);
    }
  }

  async fetchAndSaveAllIssues(
    accountId: string,
    date: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const dateString = new Date(date).toISOString().split('T')[0];
      const user = await this.userModel.findOne({ accountId }).exec();

      const issueHistory = await this.issueHistoryModel
        .findOne({ accountId: user.accountId })
        .exec();

      const specificDateHistory = issueHistory.history[dateString] || {
        issues: [],
      };

      const doneIssues =
        user.issueHistory.find((history) => {
          return history.date === dateString;
        })?.doneIssues || [];

      const doneIssueIds = new Set(
        doneIssues.map((issue) => {
          return issue.issueId;
        }),
      );

      const notDoneIssueIds = new Set(
        specificDateHistory.issues.map((issue) => {
          return issue.issueId;
        }),
      );

      specificDateHistory.issues = specificDateHistory.issues.map((issue) => {
        if (doneIssueIds.has(issue.issueId)) {
          const matchedDoneIssue = doneIssues.find((done) => {
            return done.issueId === issue.issueId;
          });

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

      const newDoneIssueEntries: IssueEntry[] = doneIssues
        .filter((issue) => {
          return !notDoneIssueIds.has(issue.issueId);
        })
        .map((issue, index) => {
          const linkedIssueIdsSet = new Set<string>();
          issue.issueLinks?.forEach((link) => {
            linkedIssueIdsSet.add(link.issueId);
          });

          return new this.issueEntryModel({
            serialNumber: specificDateHistory.issues.length + index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueSummary: issue.summary,
            issueStatus: issue.status,
            link: Array.from(linkedIssueIdsSet).join(','),
          });
        });

      specificDateHistory.issues.push(...newDoneIssueEntries);
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
        { $set: { [`history.${dateString}`]: specificDateHistory } },
        { upsert: true, new: true },
      );

      return {
        statusCode: 200,
        message: 'Issues have been successfully updated.',
      };
    } catch (error) {
      handleError(error);
    }
  }

  async getIssuesByDate(
    accountId: string,
    date: string,
  ): Promise<IUserIssuesByDate> {
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
          userName: result?.userName || '',
          accountId: result?.accountId || '',
          issues: [],
          noOfBugs: 0,
          comment: '',
          comments: [],
        };
      }

      const { issues, noOfBugs, comment, comments } = result.history[date];

      const sortedComments = comments
        ? comments.sort((a, b) => {
            return b.timestamp.getTime() - a.timestamp.getTime();
          })
        : [];

      return {
        userName: result.userName,
        accountId: result.accountId,
        issues,
        noOfBugs: noOfBugs || 0,
        comment: comment || '',
        comments: sortedComments,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async bugReportByDate(
    accountId: string,
    date: string,
    noOfBugs: number,
    comment: string,
    token: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const envToken = this.configService.get<string>('REPORT_BUG_TOKEN');
      if (!token || token !== envToken) {
        throw new ForbiddenException('Invalid or missing token');
      }

      const user = await this.userModel.findOne({ accountId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userIssueEntry = user.issueHistory.find((entry) => {
        return entry.date === date;
      });

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
      handleError(error);
    }
  }

  async createComment(
    accountId: string,
    date: string,
    comment: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const user = await this.userModel.findOne({ accountId }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const historyPath = `history.${date}`;
      const issueHistory = await this.issueHistoryModel
        .findOne({ accountId, [historyPath]: { $exists: true } })
        .exec();

      if (!issueHistory || !issueHistory.history[date]) {
        throw new NotFoundException(
          'Issue history for the specified date not found',
        );
      }

      const newComment = {
        comment,
        timestamp: new Date(),
      };

      await this.issueHistoryModel.findOneAndUpdate(
        { accountId, [`history.${date}`]: { $exists: true } },
        { $push: { [`history.${date}.comments`]: newComment } },
        { new: true },
      );

      return {
        message: 'Comment added successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }
}
