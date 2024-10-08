import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  BadRequestException,
  Put,
  Body,
} from '@nestjs/common';
import { UserService } from './users.service';
import {
  IUserResponse,
  IGetAllUsersResponse,
} from '../../common/interfaces/jira.interfaces';
import { Designation, Project } from './schemas/user.schema';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {
    // Constructor for injecting UserService
  }

  @Get()
  async getAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<IGetAllUsersResponse> {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;

    return this.userService.getAllUsers(pageNumber, limitNumber);
  }

  @Get(':accountId')
  async getUser(
    @Param('accountId') accountId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<IUserResponse> {
    return this.userService.getUser(accountId, page, limit);
  }

  @Delete(':accountId')
  async deleteUser(
    @Param('accountId') accountId: string,
  ): Promise<IUserResponse> {
    return await this.userService.deleteUser(accountId);
  }

  @Get('designations/list')
  getDesignations(): { designations: string[] } {
    const designations = Object.values(Designation);
    return { designations };
  }

  @Get('projects/list')
  getProjects(): { projects: string[] } {
    const projects = Object.values(Project);
    return { projects };
  }

  @Put(':accountId/archive')
  async archiveUser(
    @Param('accountId') accountId: string,
  ): Promise<{ message: string; statusCode: number }> {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    return this.userService.archiveUser(accountId);
  }

  @Put('save-planned-issues/morning/:accountId/:date')
  async savePlannedIssuesMorning(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<{ status: number; message: string }> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Validate date format
    if (!dateRegex.test(date)) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('Account ID cannot be empty.');
    }
    return await this.userService.fetchAndSavePlannedIssues(accountId, date);
  }

  @Put('save-all-issues/evening/:accountId/:date')
  async saveAllIssuesEvening(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<{ status: number; message: string }> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Validate date format
    if (!dateRegex.test(date)) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('Account ID cannot be empty.');
    }

    return await this.userService.fetchAndSaveAllIssues(accountId, date);
  }

  @Get('issues/:accountId/:date')
  async getIssuesByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    const response = await this.userService.getIssuesByDate(accountId, date);
    return response;
  }

  @Put('bug-report/:accountId/:date')
  async bugReportByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body('noOfBugs') noOfBugs: number,
    @Body('comment') comment: string,
    @Body('token') token: string,
  ): Promise<{ message: string; statusCode: number }> {
    if (!token) {
      throw new BadRequestException('Authorization token is required');
    }

    if (!noOfBugs) {
      throw new BadRequestException('Number of bugs is required');
    }

    const response = await this.userService.bugReportByDate(
      accountId,
      date,
      noOfBugs,
      comment,
      token,
    );

    return {
      message: response.message,
      statusCode: response.statusCode,
    };
  }
}
