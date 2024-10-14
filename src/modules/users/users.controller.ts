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
import { Designation, Project } from './schemas/user.schema';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {
    // Constructor for injecting UserService
  }

  @Get()
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.getAllUsers(page, limit);
  }

  @Get(':accountId')
  async getUser(
    @Param('accountId') accountId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.getUser(accountId, page, limit);
  }

  @Delete(':accountId')
  async deleteUser(@Param('accountId') accountId: string) {
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
  async archiveUser(@Param('accountId') accountId: string) {
    return this.userService.archiveUser(accountId);
  }

  @Put('save-planned-issues/morning/:accountId/:date')
  async savePlannedIssuesMorning(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return this.userService.fetchAndSavePlannedIssues(accountId, date);
  }

  @Put('save-all-issues/evening/:accountId/:date')
  async saveAllIssuesEvening(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return await this.userService.fetchAndSaveAllIssues(accountId, date);
  }

  @Get('issues/:accountId/:date')
  async getIssuesByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return await this.userService.getIssuesByDate(accountId, date);
  }

  @Put('bug-report/:accountId/:date')
  async bugReportByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body('noOfBugs') noOfBugs: number,
    @Body('comment') comment: string,
    @Body('token') token: string,
  ) {
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
  ) {
    const { comment } = createCommentDto;
    return await this.userService.createComment(accountId, date, comment);
  }
}
