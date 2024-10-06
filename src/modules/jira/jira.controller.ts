import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  Put,
} from '@nestjs/common';
import { JiraService } from './jira.service';

import {
  IJiraUserData,
  IUserResponse,
  IGetUserIssuesResponse,
} from '../../common/interfaces/jira.interfaces';
import { Designation, Project } from '../users/schemas/user.schema';

@Controller('jira')
export class JiraController {
  constructor(private readonly jiraService: JiraService) {
    // Constructor for injecting JiraService
  }

  @Get(':accountId/issues')
  async getUserIssues(
    @Param('accountId') accountId: string,
  ): Promise<IGetUserIssuesResponse[]> {
    return this.jiraService.getUserIssues(accountId);
  }

  @Get(':accountId')
  async getUserDetails(
    @Param('accountId') accountId: string,
  ): Promise<IJiraUserData> {
    const userDetails = await this.jiraService.getUserDetails(accountId);
    return userDetails;
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
  ): Promise<IUserResponse> {
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

    return await this.jiraService.fetchAndSaveUser(
      accountId,
      userFrom,
      designation,
      project,
    );
  }

  @Get(':accountId/issues/not-done-today')
  async countNotDoneIssues(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.jiraService.countNotDoneIssuesForToday(accountId);
  }

  @Put(':accountId/issues/not-done-today')
  async countNotDoneIssuesForToday(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.jiraService.countNotDoneIssuesForToday(accountId);
  }

  @Put(':accountId/issues/done-today')
  async countDoneIssuesForToday(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.jiraService.countDoneIssuesForToday(accountId);
  }

  @Put('update-morning-issue-history')
  async updateMorningIssueHistory(): Promise<void> {
    await this.jiraService.updateMorningIssueHistory();
  }

  @Put('update-evening-issue-history')
  async updateEveningIssueHistory(): Promise<void> {
    await this.jiraService.updateEveningIssueHistory();
  }

  @Put('metrics')
  async getUserMetrics() {
    await this.jiraService.getAllUserMetrics();
  }
}
