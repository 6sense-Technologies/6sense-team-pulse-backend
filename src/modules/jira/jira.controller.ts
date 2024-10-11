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
  IGetUserIssuesResponse,
} from '../../common/interfaces/jira.interfaces';
import { Designation, Project } from '../users/schemas/user.schema';

@Controller('jira')
export class JiraController {
  constructor(private readonly jiraService: JiraService) {
    // Constructor for injecting JiraService
  }

  @Get(':accountId')
  async getUserDetails(
    @Param('accountId') accountId: string,
  ): Promise<IJiraUserData> {
    const userDetails = await this.jiraService.getUserDetails(accountId);
    return userDetails;
  }

  @Get('users/issues/:accountId/:date')
  async getUserIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<IGetUserIssuesResponse[]> {
    return this.jiraService.getUserIssues(accountId, date);
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
  ) {
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

  @Put('planned-issues/:accountId/:date')
  async countNotDoneIssuesForToday(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
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
    await this.jiraService.countPlannedIssues(accountId, date);
  }

  @Put('done-issues/:accountId/:date')
  async countDoneIssuesForToday(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
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

  @Put('metrics')
  async getUserMetrics() {
    await this.jiraService.getAllUserMetrics();
  }

  @Put('daily-metrics/:accountId/:date')
  async calculateDailyMetrics(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
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
    const result = await this.jiraService.calculateDailyMetrics(accountId, date);
    return result;
  }
  @Put('current/:accountId/:date')
  async calculateCurrentPerformance(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
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
    const result = await this.jiraService.calculateCurrentPerformance(accountId, date);
    return result;
  }
}
