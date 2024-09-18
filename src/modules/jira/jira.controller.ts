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
} from '../../interfaces/jira.interfaces';

@Controller('jira')
export class JiraController {
  constructor(private readonly jiraService: JiraService) {}

  @Get(':accountId/issues')
  async getUserIssues(
    @Param('accountId') accountId: string,
  ): Promise<IGetUserIssuesResponse> {
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
    @Body() body: { accountId: string },
  ): Promise<IUserResponse> {
    const { accountId } = body;
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    return await this.jiraService.fetchAndSaveUser(accountId);
  }
  @Post(':accountId/issues/not-done')
  async countNotDoneIssues(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.jiraService.countNotDoneIssues(accountId);
    return;
  }

  @Post(':accountId/issues/done')
  async countDoneIssues(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.jiraService.countDoneIssues(accountId);
    return;
  }

  @Put('update-morning-issue-history')
  async updateMorningIssueHistory(): Promise<void> {
    await this.jiraService.updateMorningIssueHistory();
    return;
  }

  @Put('update-evening-issue-history')
  async updateEveningIssueHistory(): Promise<void> {
    await this.jiraService.updateEveningIssueHistory();
    return;
  }
}
