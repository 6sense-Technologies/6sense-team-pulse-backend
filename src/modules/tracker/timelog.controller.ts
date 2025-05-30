import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  Patch,
  Delete,
} from '@nestjs/common';
// import { TrackerService } from './tracker.service';
import { ActivityService } from './activity.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { AssignActivitiesDto } from './dto/assign-activities.dto';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { WorksheetService } from './worksheet.service';
import { WorksheetGetNamesQueryDto } from './dto/worksheet-get-names.query';
import { Auth } from '../auth/decorators/auth.decorator';
import { CreateManualActivityDto } from './dto/create-manaul-activity.dto';
import { UpdateManualActivityDto } from './dto/update-manaul-activity.dto';
import { RemoveActivitiesDto } from './dto/remove-activities.dto';

@Controller('timelog')
export class TimelogController {
  constructor(
    // @InjectQueue('logs')
    // private readonly logsQueue: Queue, // Inject the logs queue
    // private readonly trackerService: TrackerService,
    private readonly activityService: ActivityService,
    private readonly worksheetService: WorksheetService,
  ) {
    // do nothing.
  }

  // @Post()
  // create(@Body() createTrackerDto: CreateTrackerDto) {
  //   return this.trackerService.create(createTrackerDto);
  // }

  // @UseGuards(AccessTokenGuard)
  //   @ApiBearerAuth()
  //   @Get('list-organizations')
  //   listOrganizations(@Req() req: Request) {
  //     return this.authService.listOrganizations(req['user'].userId);
  //   }

  //   @UseGuards(AccessTokenGuard)
  //   @ApiBearerAuth()
  //   @Post('add-activity-logs')
  //   async addActivityLogsToQueue(
  //     @Body() createActivitiesDto: CreateActivitiesDto,
  //     @Req() req: Request
  //   ) {
  //     return await this.activityService.addActivityLogsToQueue(req['user'].userId, createActivitiesDto.organization_id, createActivitiesDto.activity_log);
  //   }

  // @UseGuards(AccessTokenGuard)
  // @ApiBearerAuth()
  // @Post('create-activity')
  // async createActivity(
  //   @Req() req: Request,
  //   @Body() createActivitiesDto: CreateActivitiesDto
  // ) {
  //   return await this.trackerService.createActivity(createActivitiesDto, req['user'].userId);
  // }

  @Auth()
  @ApiBearerAuth()
  @Get('unreported')
  async findUnreportedActivitiesForCurrentUser(
    @Req() req: Request,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Query('date') date?: string,
    @Query('sort-order') sortOrder?: 'latest' | 'oldest',
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<any> {
    console.log('Date: ', date);
    console.log('Timezone Offset: ', metadata.timezoneRegion);
    console.log('Sort Order: ', sortOrder);
    console.log('Page: ', page);
    console.log('Limit: ', limit);
    console.log('Organization User ID: ', req['user'].organizationId);
    console.log('User ID: ', req['user'].userId);
    return await this.activityService.findUnreportedActivitiesForCurrentUser(
      req['user'].userId,
      req['user'].organizationId,
      date,
      metadata.timezoneRegion,
      sortOrder,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Post('unreported/manual-entry')
  @ApiOperation({ summary: 'Create a manual activity entry' })
  @ApiBody({ type: CreateManualActivityDto })
  @ApiResponse({
    status: 201,
    description: 'Manual activity successfully created',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createManualActivity(
    @Req() req: Request,
    @Body() createManualActivityDto: CreateManualActivityDto,
  ): Promise<any> {
    const userId = req['user'].userId;
    const organizationId = req['user'].organizationId;

    return await this.activityService.createManualActivity(
      createManualActivityDto,
      userId,
      organizationId,
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Patch('unreported/manual-entry/:id')
  @ApiOperation({ summary: 'Update a manual activity entry' })
  @ApiParam({ name: 'id', type: String, description: 'Activity ID' })
  @ApiResponse({ status: 200, description: 'Manual activity updated' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation or logical failure',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Manual activity not found' })
  async editManualActivity(
    @Param('id') activityId: string,
    @Req() req: Request,
    @Body() updateDto: UpdateManualActivityDto,
  ): Promise<any> {
    const userId = req['user'].userId;
    const organizationId = req['user'].organizationId;

    return this.activityService.editManualActivity(
      activityId,
      userId,
      organizationId,
      updateDto,
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Post('unreported/assign-to-project')
  @ApiOperation({ summary: 'Assign activities to a worksheet' })
  async assignActivitiesToWorksheet(
    @Req() req: any,
    @Body() assignActivitiesDto: AssignActivitiesDto,
  ): Promise<any> {
    const userId = req.user.userId;

    return await this.worksheetService.assignActivitiesToWorksheet(
      userId,
      req['user'].organizationId,
      assignActivitiesDto,
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Delete('worksheet/remove-activities')
  @ApiOperation({ summary: 'Remove activities from a worksheet' })
  async removeActivitiesFromWorksheet(
    @Req() req: any,
    @Body() removeActivitiesDto: RemoveActivitiesDto,
  ): Promise<any> {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    return await this.worksheetService.removeActivitiesFromWorksheet(
      userId,
      organizationId,
      removeActivitiesDto.worksheetId,
      removeActivitiesDto.activityIds,
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Get('worksheet/get-names')
  @ApiOperation({ summary: 'Get worksheet names and reported time' })
  @ApiResponse({ status: 200, description: 'List of worksheet names' })
  async getWorksheetNames(
    @Req() req: any,
    @Query() query: WorksheetGetNamesQueryDto,
  ): Promise<any> {
    const userId = req.user.userId;

    return await this.worksheetService.getWorksheetNames(
      userId,
      req['user'].organizationId,
      query['project-id'],
      query.name,
      query.date,
    );
  }

  @Get('worksheet/list')
  @ApiOperation({ summary: 'Get list of worksheets' })
  @ApiResponse({ status: 200, description: 'List of worksheets' })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  @Auth()
  @ApiBearerAuth()
  async getWorksheets(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('start-date') startDate?: string,
    @Query('end-date') endDate?: string,
    @Query('sort-order') sortOrder: 'latest' | 'oldest' = 'latest',
  ): Promise<any> {
    const userId = req.user.userId;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (startDate && !dateRegex.test(startDate)) {
      throw new BadRequestException(
        'Invalid start-date format. Expected YYYY-MM-DD.',
      );
    }

    if (endDate && !dateRegex.test(endDate)) {
      throw new BadRequestException(
        'Invalid end-date format. Expected YYYY-MM-DD.',
      );
    }

    return this.worksheetService.getWorksheets(
      userId,
      req['user'].organizationId,
      parseInt(page, 10),
      parseInt(limit, 10),
      sortOrder,
      startDate,
      endDate,
    );
  }

  @Auth()
  @ApiBearerAuth()
  @Get('worksheet/:worksheetId')
  @ApiOperation({ summary: 'Get activities in a worksheet' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort-order',
    required: false,
    enum: ['latest', 'oldest'],
    default: 'latest',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of activities in the worksheet',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  async getActivitiesForWorksheet(
    @Req() req: any,
    @Param('worksheetId') worksheetId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort-order') sortOrder: 'latest' | 'oldest' = 'latest',
    @Query('search') search?: string,
  ): Promise<any> {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const isAdmin = false; // Assuming role is part of user object

    return this.worksheetService.getActivitiesForWorksheet(
      userId,
      organizationId,
      worksheetId,
      parseInt(page),
      parseInt(limit),
      sortOrder,
      search,
      isAdmin,
    );
  }

  // @Get()
  // findAll() {
  //   return this.trackerService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.trackerService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateTrackerDto: UpdateTrackerDto) {
  //   return this.trackerService.update(+id, updateTrackerDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.trackerService.remove(+id);
  // }
}
