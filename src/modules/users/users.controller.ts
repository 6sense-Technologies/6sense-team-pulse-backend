import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  BadRequestException,
  Put,
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
  async collectIssueHistoryMorning(): Promise<{ message: string }> {
    await this.userService.fetchAndSaveNotDoneIssuesForAllUsers();
    return { message: 'Issue history collected and saved successfully.' };
  }
  
  @Put('collect-history/all/evening')
  async collectIssueHistoryEvening(): Promise<{ message: string }> {
    await this.userService.fetchAndSaveDoneIssuesForAllUsers();
    return { message: 'Issue history collected and saved successfully.' };
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
}
