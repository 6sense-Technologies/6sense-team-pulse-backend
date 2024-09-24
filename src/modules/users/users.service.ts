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

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
}
