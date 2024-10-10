import {
  Controller,
  Get,
  Param,
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
    return await this.trelloService.getUserDetails(accountId);
  }

  @Get('users/:accountId/issues')
  async getUserIssues(@Param('accountId') accountId: string) {
    return this.trelloService.getUserIssues(accountId);
  }

  @Post('users/create')
  async fetchAndSaveUser(
    @Param('accountId') accountId: string,
    @Body('userFrom') userFrom: string,
    @Body('designation') designation: Designation,
    @Body('project') project: Project,
  ) {
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
  ) {
    return await this.trelloService.countPlannedIssues(accountId, date);
  }

  @Get('done/count/:accountId')
  async countDoneIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ) {
    return await this.trelloService.countDoneIssues(accountId, date);
  }
}
