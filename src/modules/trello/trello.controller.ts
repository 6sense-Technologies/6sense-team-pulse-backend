import {
  Controller,
  Get,
  Param,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { TrelloService } from './trello.service';
import { Designation, Project } from '../users/schemas/user.schema';

@Controller('trello')
export class TrelloController {
  constructor(private readonly trelloService: TrelloService) {}

  @Get('boards')
  async getBoards() {
    const boards = await this.trelloService.getBoards();
    return boards;
  }

  @Get('users')
  async getUsers() {
    const users = await this.trelloService.getUsers();
    return users;
  }

  @Get('users/:accountId')
  async getUserDetails(@Param('accountId') accountId: string) {
    const userDetails = await this.trelloService.getUserDetails(accountId);
    return userDetails;
  }

  @Get('users/:accountId/issues')
  async getUserIssues(@Param('accountId') accountId: string) {
    return this.trelloService.getUserIssues(accountId);
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
    if (!userFrom) {
      throw new BadRequestException('userFrom is required');
    }

    return await this.trelloService.fetchAndSaveUser(
      accountId,
      userFrom,
      designation,
      project,
    );
  }

  @Get('not-done/count/:accountId/:date')
  async countPlannedIssues(
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
    await this.trelloService.countPlannedIssues(accountId, date);
    return;
  }

  @Get('done/count/:accountId')
  async countDoneIssues(
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
    await this.trelloService.countDoneIssues(accountId, date);
    return;
  }
}
