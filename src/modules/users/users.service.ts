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
import { IssueEntry, IssueHistory } from './schemas/IssueHistory.schems';

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
        // Find the history entry for the current date
        const todayHistory = user.issueHistory.find(history => history.date === dateString);

        if (!todayHistory) {
            console.log(`No issues found for user: ${user.displayName} on ${dateString}`);
            continue;
        }

        const notDoneIssues = todayHistory.notDoneIssues || [];

        if (notDoneIssues.length === 0) {
            console.log(`No Not Done issues found for user: ${user.displayName} on ${dateString}`);
            continue;
        }

        const issueHistoryEntries: IssueEntry[] = notDoneIssues.map((issue, index) => ({
            serialNumber: index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueStatus: issue.status,
            planned: true,
        }));

        // Prepare the issue history document to save
        const issueHistory = new this.issueHistoryModel({
            userName: user.displayName,
            accountId: user.accountId,
            history: [{ date: dateString, issues: issueHistoryEntries }],
        });

        await issueHistory.save();

        console.log(`Not Done issues saved to Issue History for user: ${user.displayName} on ${dateString}`);
    }

    return 'Not Done issues saved for all users';
}

  
async fetchAndSaveDoneIssuesForAllUsers() {
  // Fetch all users
  const users = await this.userModel.find().exec();

  // Get today's date in "YYYY-MM-DD" format
  const today = new Date().toISOString().split('T')[0]; // "2024-09-26"

  for (const user of users) {
      // Find the history entry for the current date
      const todayHistory = user.issueHistory.find(history => history.date === today);

      if (!todayHistory) {
          console.log(`No Done issues found for user: ${user.displayName} on ${today}`);
          continue;
      }

      const doneIssues = todayHistory.doneIssues || [];

      if (doneIssues.length === 0) {
          console.log(`No Done issues found for user: ${user.displayName} on ${today}`);
          continue;
      }

      // Fetch existing Issue History for this user
      const existingIssueHistory = await this.issueHistoryModel.findOne({ userName: user.displayName }).exec();

      // Extract not done issue IDs to filter out duplicates
      const notDoneIssueIds = existingIssueHistory
          ? existingIssueHistory.history.flatMap(entry => entry.issues.map(issue => issue.issueId))
          : [];

      // Filter out done issues that match any not done issue IDs
      const uniqueDoneIssues = doneIssues.filter(doneIssue => !notDoneIssueIds.includes(doneIssue.issueId));

      if (uniqueDoneIssues.length === 0) {
          console.log(`No new Done issues to save for user: ${user.displayName} on ${today}`);
          continue;
      }

      // Check if there is already an entry for today's date in the history
      const existingHistoryEntry = existingIssueHistory?.history.find(
          (entry) => entry.date === today // Compare directly with the date string
      );

      // Determine the starting serial number
      let nextSerialNumber = 1;
      if (existingHistoryEntry && existingHistoryEntry.issues.length > 0) {
          // Get the highest serial number for that date and increment it
          const maxSerialNumber = Math.max(...existingHistoryEntry.issues.map(issue => issue.serialNumber));
          nextSerialNumber = maxSerialNumber + 1;
      }

      // Prepare the issue entries with correct serial numbers
      const issueHistoryEntries: IssueEntry[] = uniqueDoneIssues.map((issue, index) => ({
          serialNumber: nextSerialNumber + index,  // Serial number starts from the next available one
          issueType: issue.issueType,
          issueId: issue.issueId,
          issueStatus: issue.status,
      }));

      if (existingHistoryEntry) {
          // Append the new done issues to the existing history entry for today
          existingHistoryEntry.issues.push(...issueHistoryEntries);
          await existingIssueHistory.save();
      } else {
          // Create a new history entry for today if it doesn't exist
          const newHistoryEntry = {
              date: today, // Save the date as a string in "YYYY-MM-DD" format
              issues: issueHistoryEntries,
          };

          if (existingIssueHistory) {
              existingIssueHistory.history.push(newHistoryEntry);
              await existingIssueHistory.save();
          } else {
              const issueHistory = new this.issueHistoryModel({
                  userName: user.displayName,
                  accountId: user.accountId,  // Get accountId from user table
                  history: [newHistoryEntry],
              });
              await issueHistory.save();
          }
      }

      console.log(`Done issues saved to Issue History for user: ${user.displayName} on ${today}`);
  }

  return 'Done issues saved for all users';
}

  
  async getIssuesByAccountAndDate(accountId: string, date: string) {
    return this.issueHistoryModel.findOne(
      { accountId, 'history.date': date },
      { 'history.$': 1 }
    ).exec();
  }
  
}
