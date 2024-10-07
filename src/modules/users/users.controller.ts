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

  @Put('collect-history/all/morning')
  async collectIssueHistoryMorning(): Promise<void> {
    await this.userService.fetchAndSaveNotDoneIssuesForAllUsers();
  }

  @Put('collect-history/all/evening')
  async collectIssueHistoryEvening(): Promise<void> {
    await this.userService.fetchAndSaveDoneIssuesForAllUsers();
  }

  @Get('issues/:accountId/:date')
  async getIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    const response = await this.userService.getIssuesByAccountAndDate(
      accountId,
      date,
    );
    return response;
  }

  @Put(':accountId/bug-report/:date')
  async reportBug(
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

    const response = await this.userService.reportBug(
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
