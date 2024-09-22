import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Designation, User } from './schemas/user.schema';
import {
  IJiraUserData,
  IUserResponse,
  IUserWithPagination,
} from '../../interfaces/jira.interfaces';
import { ValidationError } from 'class-validator';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async saveUser(
    accountId: string,
    userData: IJiraUserData,
    designation: Designation,
  ): Promise<{ message: string; statusCode: number; user?: User }> {
    try {
      if (!Object.values(Designation).includes(designation)) {
        throw new BadRequestException(`Invalid designation: ${designation}`);
      }

      const avatar48x48 = userData.avatarUrls['48x48'];

      const userToSave = {
        accountId: userData.accountId,
        displayName: userData.displayName,
        emailAddress: userData.emailAddress,
        avatarUrls: avatar48x48,
        currentPerformance: userData.currentPerformance || 0,
        designation,
      };

      const existingUser = await this.userModel.findOne({ accountId });
      if (existingUser) {
        return {
          message: 'User already exists',
          statusCode: 409,
        };
      } else {
        const newUser = new this.userModel(userToSave);
        await newUser.save();
        return {
          message: 'User saved successfully',
          statusCode: 201,
          user: newUser,
        };
      }
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        return {
          message: `Mongoose validation error`,
          statusCode: 400,
        };
      }
      return {
        message: error.message || 'Internal Server Error',
        statusCode: error.status || 500,
      };
    }
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
      const skip = (page - 1) * limit;
      const totalUsers = await this.userModel.countDocuments({
        isArchive: false,
      });
      const users = await this.userModel
        .find(
          { isArchive: false },
          'accountId displayName emailAddress avatarUrls currentPerformance designation',
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
    page: number = 1,
    limit: number = 1,
  ): Promise<IUserResponse> {
    try {
      const user = await this.userModel.findOne({ accountId }).exec();

      if (!user) {
        throw new NotFoundException(`User not found`);
      }

      // Calculate pagination parameters
      const skip = (page - 1) * limit;

      // Sort the issueHistory by date and then paginate
      const totalIssueHistory = user.issueHistory.length;
      const sortedIssueHistory = user.issueHistory
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(skip, skip + limit); // Slice for pagination

      const totalPages = Math.ceil(totalIssueHistory / limit); // Total pages based on issue history

      // Create a new user object with paginated issue history
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
        throw new NotFoundException(`User not found`);
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
        throw new NotFoundException(`User with accountId not found`);
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
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error archiving user');
    }
  }
}
