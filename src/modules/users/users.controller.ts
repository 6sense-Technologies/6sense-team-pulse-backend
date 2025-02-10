import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  Put,
  Body,
  Post,
  Req,
  UseGuards,
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
import { CreateUserDto } from './dto/create-user.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {
    // Constructor for injecting UserService
  }
  // Experimental Modification
  @Get('user-info')
  async getUserInfo(@Query('userId') userId: string) {
    return this.userService.getUserInfo(userId);
  }
  @Get('individual')
  async calculateIndividualStats(
    @Query('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userService.calculateIndividualStats(userId, page, limit);
  }
  @Get('overview')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async calculateOverview(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: Request,
  ) {
    return this.userService.calculateOverview(page, limit, req['user'].userId);
  }
  @Get('daily-performance')
  async calculateDailyPerformence(
    @Query('userId') userId: string,
    @Query('dateTime') dateTime: string,
    @Query('Page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userService.dailyPerformence(userId, dateTime, page, limit);
  }
  //------------------------///
  @Get()
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IAllUsers> {
    return this.userService.getAllUsers(page, limit);
  }

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto): Promise<any> {
    return this.userService.createUser(createUserDto);
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
  async getProjects() {
    return this.userService.getProjects();
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
