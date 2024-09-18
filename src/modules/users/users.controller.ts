import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from './users.service';
import {
  IUserResponse,
  IGetAllUsersResponse,
} from '../../interfaces/jira.interfaces';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<IGetAllUsersResponse> {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;

    return this.userService.getAllUsers(pageNumber, limitNumber);
  }

  @Get(':accountId')
  async getUser(
    @Param('accountId') accountId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ): Promise<IUserResponse> {
    return this.userService.getUser(accountId, page, limit);
  }
  

  @Delete(':accountId')
  async deleteUser(
    @Param('accountId') accountId: string,
  ): Promise<IUserResponse> {
    return await this.userService.deleteUser(accountId);
  }
}
