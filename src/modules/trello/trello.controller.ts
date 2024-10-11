import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  BadRequestException,
} from '@nestjs/common';
import { TrelloService } from './trello.service';
import { Designation, Project } from '../users/schemas/user.schema';

@Controller('trello')
export class TrelloController {
  constructor(private readonly trelloService: TrelloService) {
    // Constructor for injecting TrelloService
  }

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
    return await this.trelloService.getUserDetails(accountId);
  }

  @Get('users/issues/:accountId/:date')
  async getUserIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return this.trelloService.getUserIssues(accountId, date);
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

    return await this.trelloService.fetchAndSaveUser(
      accountId,
      userFrom,
      designation,
      project,
    );
  }

  @Put('not-done/count/:accountId/:date')
  async countPlannedIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return await this.trelloService.countPlannedIssues(accountId, date);
  }

  @Put('done/count/:accountId/:date')
  async countDoneIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return await this.trelloService.countDoneIssues(accountId, date);
  }
}
