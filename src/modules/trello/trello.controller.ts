import {
  Controller,
  Get,
  Param,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { TrelloService } from './trello.service';
import { ITrelloUserData } from 'src/common/interfaces/jira.interfaces';
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
  async getMembers() {
    const members = await this.trelloService.getMembers();
    return members;
  }

  @Get('users/:accountId')
  async getUserDetails(
    @Param('accountId') accountId: string,
  ) {
    const userDetails = await this.trelloService.getMemberDetails(accountId);
    return userDetails;
  }

  @Get(':accountId/issues')
  async getUserIssues(@Param('accountId') accountId: string) {
    return this.trelloService.getUserCards(accountId);
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

  @Get('not-done/count/:accountId')
  async countNotDoneIssuesForToday(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.trelloService.countNotDoneIssuesForToday(accountId);
    return;
  }

  @Get('done/count/:accountId')
  async countDoneIssuesForToday(
    @Param('accountId') accountId: string,
  ): Promise<void> {
    await this.trelloService.countDoneIssuesForToday(accountId);
    return;
  }
}
