import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  Put,
  Inject,
} from '@nestjs/common';
import { JiraService } from './jira.service';
import {
  IDailyMetrics,
  IJiraUserData,
  IJirsUserIssues,
  ISuccessResponse,
} from 'src/common/interfaces/jira.interfaces';
import { Designation, Project } from '../users/enums/user.enum';
import { ClientMqtt, MessagePattern, Payload } from '@nestjs/microservices';
import { DataFetcherDTO } from './dto/jira.dto';

@Controller('jira')
export class JiraController {
  constructor(
    private readonly jiraService: JiraService,
    @Inject('DATA_FETCHER_SERVICE') private client: ClientMqtt,
  ) {
    // Constructor for injecting JiraService
  }

  /*Experimental Modification*/

  async onApplicationBootstrap() {
    await this.client.connect();
  }

  @MessagePattern('job.result')
  async getResult(@Payload() data: any) {
    // this.jiraService.fetchAndSaveFromJira(data);
    return 'disabled';
  }

  @Post('job-result')
  async saveResult(@Body() data: any) {
    console.log(data);
    this.jiraService.fetchAndSaveFromJira(data);
  }
  //---------------------------/
  @Get(':accountId')
  async getUserDetails(
    @Param('accountId') accountId: string,
  ): Promise<IJiraUserData> {
    return await this.jiraService.getUserDetails(accountId);
  }

  @Get('users/issues/:accountId/:date')
  async getUserIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<IJirsUserIssues[]> {
    return await this.jiraService.getUserIssues(accountId, date);
  }

  @Post('users/create')
  async fetchAndSaveUser(
    @Body()
    body: {
      accountId: string;
      userFrom: string;
      designation: Designation;
      project: Project;
    },
  ): Promise<ISuccessResponse> {
    const { accountId, userFrom, designation, project } = body;

    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    if (!designation) {
      throw new BadRequestException('designation is required');
    }
    if (!project) {
      throw new BadRequestException('project is required');
    }
    if (!userFrom) {
      throw new BadRequestException('userFrom is required');
    }

    return await this.jiraService.fetchAndSaveUser(
      accountId,
      userFrom,
      designation,
      project,
    );
  }

  @Put('user/:accountId')
  async fetchAndUpdateUser(
    @Param('accountId') accountId: string,
  ): Promise<ISuccessResponse> {
    return await this.jiraService.fetchAndUpdateUser(accountId);
  }

  @Put('planned-issues/:accountId/:date')
  async countNotDoneIssuesForToday(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.countPlannedIssues(accountId, date);
  }

  @Put('done-issues/:accountId/:date')
  async countDoneIssuesForToday(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.countDoneIssues(accountId, date);
  }

  @Put('update-morning-issue-history')
  async updateMorningIssueHistory(): Promise<void> {
    await this.jiraService.updateMorningIssueHistory();
  }

  @Put('update-evening-issue-history')
  async updateEveningIssueHistory(): Promise<void> {
    await this.jiraService.updateEveningIssueHistory();
  }

  @Put('update-morning-issue-history/:date')
  async updateMorningIssueHistoryForSpecificDate(
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.updateMorningIssueHistoryForSpecificDate(date);
  }
  @Put('update-evening-issue-history/:date')
  async updateEveningIssueHistoryForSpecificDate(
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.updateEveningIssueHistoryForSpecificDate(date);
  }

  @Put('update-morning-issue-history/:accountId/:date')
  async updateMorningIssueHistoryForSpecificUser(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.updateMorningIssueHistoryForSpecificUser(
      accountId,
      date,
    );
  }

  @Put('update-evening-issue-history/:accountId/:date')
  async updateEveningIssueHistoryForSpecificUser(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
    await this.jiraService.updateEveningIssueHistoryForSpecificUser(
      accountId,
      date,
    );
  }

  @Put('daily-metrics/:accountId/:date')
  async calculateDailyMetrics(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<IDailyMetrics> {
    return await this.jiraService.calculateDailyMetrics(accountId, date);
  }
}
