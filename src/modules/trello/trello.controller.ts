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
import { ITrelloBoard, ITrelloUsers } from './interfaces/trello.interfaces';
import { ISuccessResponse } from 'src/common/interfaces/jira.interfaces';
import { Designation, Project } from '../users/enums/user.enum';

@Controller('trello')
export class TrelloController {
  constructor(private readonly trelloService: TrelloService) {
    // Constructor for injecting TrelloService
  }

  @Get('boards')
  async getBoards(): Promise<ITrelloBoard[]> {
    const boards = await this.trelloService.getBoards();
    return boards;
  }

  @Get('users')
  async getUsers(): Promise<ITrelloUsers[]> {
    return await this.trelloService.getUsers();
  }

  @Get('users/:accountId')
  async getUserDetails(@Param('accountId') accountId: string): Promise<any> {
    return await this.trelloService.getUserDetails(accountId);
  }

  @Get('users/issues/:accountId/:date')
  async getUserIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<any[]> {
    return this.trelloService.getUserIssues(accountId, date);
  }

  @Post('users/create')
  async fetchAndSaveUser(
    @Body()
    body: {
      accountId: string;
      userFrom: string;
      designation: Designation;
      project: Project[];
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
  ): Promise<void> {
    await this.trelloService.countPlannedIssues(accountId, date);
  }

  @Put('done/count/:accountId/:date')
  async countDoneIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<void> {
    await this.trelloService.countDoneIssues(accountId, date);
  }
}
