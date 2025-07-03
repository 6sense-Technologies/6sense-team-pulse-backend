import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ISuccessResponse } from 'src/common/interfaces/jira.interfaces';
import { GetUser } from 'src/common/request-metadata/getUser.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { InviteUserDTO } from './dto/invite-user.dto';
import { Designation } from './enums/user.enum';
import {
  IAllUsers,
  IUserIssuesByDate,
  IUserResponse,
  IUserWithOrganization,
} from './interfaces/users.interfaces';
import { UserService } from './users.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {
    // Constructor for injecting UserService
  }

  @Get('list')
  @Auth(['Admin', 'Member'])
  @ApiBearerAuth()
  async userList(
    @Query('search') search: string = '',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: Request,
  ): Promise<any> {
    return this.userService.userList(search, page, limit, req['user'].organizationId);
  }

  // Experimental Modification
  @Auth(['Admin', 'Member'])
  @ApiBearerAuth()
  @Get('user-info')
  async getUserInfo(
    @Query('userId') userId: string, 
    @GetUser() user: IUserWithOrganization
  ): Promise<{
    userData: any;
    currentMonthScore: number;
    lastMonthScore: number;
  }> {
    return this.userService.getUserInfo(userId, user);
  }

  @Auth(['Admin', 'Member'])
  @ApiBearerAuth()
  @Get('individual')
  async calculateIndividualStats(
    @Query('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @GetUser() user: IUserWithOrganization,
  ) {
    return this.userService.calculateIndividualStats(userId, user, page, limit);
  }

  @Auth(['Admin', 'Member'])
  @ApiBearerAuth()
  @Get('overview')
  async calculateOverview(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @GetUser() user: IUserWithOrganization,
  ): Promise<any[]> {
    return this.userService.calculateOverview(page, limit, user);
  }

  @Auth(['Admin', 'Member'])
  @ApiBearerAuth()
  @Get('daily-performance')
  async calculateDailyPerformence(
    @Query('userId') userId: string,
    @Query('dateTime') dateTime: string,
    @Query('Page') page: number = 1,
    @Query('limit') limit: number = 10,
    @GetUser() user: IUserWithOrganization,
  ) {
    return this.userService.dailyPerformence(userId, user, dateTime, page, limit);
  }

  @Post('toggle-enable')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Roles(['Admin'])
  @UseGuards(RolesGuard)
  async toggleEnable(@Query('userId') userId: string, @Req() req: Request) {
    return this.userService.toggleEnable(userId, req['user'].userId);
  }

  @Post('invite')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      limits: { fileSize: 100 * 1024 }, // 100KB limit
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|jpg)$/)) {
          return callback(
            new BadRequestException('Only JPEG, PNG, and JPG files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @Roles(['Admin'])
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @UseGuards(RolesGuard)
  async invite(
    @Body() inviteUserDTO: InviteUserDTO,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.userService.inviteUser(inviteUserDTO, req['user'].userId, file);
  }

  //------------------------///
  @Get()
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IAllUsers> {
    return this.userService.getAllUsers(page, limit);
  }

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto): Promise<any> {
    return this.userService.createUser(createUserDto);
  }

  @Auth(['admin', 'member'])
  @Get('all-issues/:userId')
  async getAllIssues(
    @GetUser() user: IUserWithOrganization,
    @Param('userId') userId: string,
  ): Promise<any> {
    return this.userService.getAllIssues(user, userId);
  }

  @Get(':accountId')
  async getUser(
    @Param('accountId') accountId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IUserResponse> {
    return this.userService.getUser(accountId, page, limit);
  }

  @Delete(':accountId')
  async deleteUser(@Param('accountId') accountId: string): Promise<ISuccessResponse> {
    return await this.userService.deleteUser(accountId);
  }

  @Get('designations/list')
  getDesignations(): { designations: string[] } {
    const designations = Object.values(Designation);
    return { designations };
  }

  @Get('projects/list')
  async getProjects() {
    return this.userService.getProjects();
  }

  @Put(':accountId/archive')
  async archiveUser(@Param('accountId') accountId: string): Promise<ISuccessResponse> {
    return this.userService.archiveUser(accountId);
  }

  @Put('save-planned-issues/morning/:accountId/:date')
  async fetchAndSavePlannedIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<ISuccessResponse> {
    return this.userService.fetchAndSavePlannedIssues(accountId, date);
  }

  @Put('save-all-issues/evening/:accountId/:date')
  async fetchAndSaveAllIssues(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<ISuccessResponse> {
    return await this.userService.fetchAndSaveAllIssues(accountId, date);
  }

  @Get('issues/:accountId/:date')
  async getIssuesByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
  ): Promise<IUserIssuesByDate> {
    return await this.userService.getIssuesByDate(accountId, date);
  }

  @Put('bug-report/:accountId/:date')
  async bugReportByDate(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body('noOfBugs') noOfBugs: number,
    @Body('comment') comment: string,
    @Body('token') token: string,
  ): Promise<ISuccessResponse> {
    return await this.userService.bugReportByDate(accountId, date, noOfBugs, comment, token);
  }

  @Post('comment/:accountId/:date')
  async createComment(
    @Param('accountId') accountId: string,
    @Param('date') date: string,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<ISuccessResponse> {
    const { comment } = createCommentDto;
    return await this.userService.createComment(accountId, date, comment);
  }
}
