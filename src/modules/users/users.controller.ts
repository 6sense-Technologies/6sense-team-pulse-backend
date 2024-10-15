import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  Put,
  Body,
  Post,
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  IAllUsers,
  IUserResponse,
  IUserIssuesByDate,
} from './interfaces/users.interfaces';
import { ISuccessResponse } from 'src/common/interfaces/jira.interfaces';
import { Designation, Project } from './enums/user.enum';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {
    // Constructor for injecting UserService
  }

  @Get()
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IAllUsers> {
    return this.userService.getAllUsers(page, limit);
  }

  @Get(':accountId')
  async getUser(
    @Param('accountId') accountId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IUserResponse> {
    return this.userService.getUser(accountId, page, limit);
  }

  @Delete(':accountId')
  async deleteUser(
    @Param('accountId') accountId: string,
  ): Promise<ISuccessResponse> {
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
  ): Promise<ISuccessResponse> {
    return this.userService.archiveUser(accountId);
  }

  @Put('save-planned-issues/morning/:accountId/:date')
  async fetchAndSavePlannedIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<ISuccessResponse> {
    return this.userService.fetchAndSavePlannedIssues(accountId, date);
  }

  @Put('save-all-issues/evening/:accountId/:date')
  async fetchAndSaveAllIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<ISuccessResponse> {
    return await this.userService.fetchAndSaveAllIssues(accountId, date);
  }

  @Get('issues/:accountId/:date')
  async getIssuesByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<IUserIssuesByDate> {
    return await this.userService.getIssuesByDate(accountId, date);
  }

  @Put('bug-report/:accountId/:date')
  async bugReportByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body('noOfBugs') noOfBugs: number,
    @Body('comment') comment: string,
    @Body('token') token: string,
  ): Promise<ISuccessResponse> {
    return await this.userService.bugReportByDate(
      accountId,
      date,
      noOfBugs,
      comment,
      token,
    );
  }

  @Post('comment/:accountId/:date')
  async createComment(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<ISuccessResponse> {
    const { comment } = createCommentDto;
    return await this.userService.createComment(accountId, date, comment);
  }
}
