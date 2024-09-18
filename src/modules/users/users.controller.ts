import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  Post,
  BadRequestException,
  Put,
} from '@nestjs/common';
import { UserService } from './users.service';
import {
  IUserResponse,
  IGetAllUsersResponse,
} from '../../interfaces/jira.interfaces';
import { Designation } from './schemas/user.schema';

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

  @Get('designations/list')
  getDesignations(): { designations: string[] } {
    const designations = Object.values(Designation);
    return { designations };
  }

  @Put(':accountId/archive')
  async archiveUser(@Param('accountId') accountId: string): Promise<{ message: string; statusCode: number }> {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    return this.userService.archiveUser(accountId);
  }
}
