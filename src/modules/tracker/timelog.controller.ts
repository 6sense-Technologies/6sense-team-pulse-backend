import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
// import { TrackerService } from './tracker.service';
import { ActivityService } from './activity.service';
import { CreateTrackerDto } from './dto/create-tracker.dto';
import { UpdateTrackerDto } from './dto/update-tracker.dto';
import { CreateActivitiesDto } from './dto/create-activities.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AssignActivitiesDto } from './dto/assign-activities.dto';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { WorksheetService } from './worksheet.service';
import { WorksheetGetNamesQueryDto } from './dto/worksheet-get-names.query';

@Controller('timelog')
export class TimelogController {
  constructor(
    // @InjectQueue('logs')
    // private readonly logsQueue: Queue, // Inject the logs queue
    // private readonly trackerService: TrackerService,
    private readonly activityService: ActivityService,
    private readonly worksheetService: WorksheetService,
  ) {}

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

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('unreported')
  async findUnreportedActivitiesForCurrentUser(
    @Req() req: Request,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Query('date') date?: string,
    @Query('sortOrder') sortOrder?: 'latest' | 'oldest',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    console.log('Date: ', date);
    console.log('Timezone Offset: ', metadata.timezoneRegion);
    console.log('Sort Order: ', sortOrder);
    console.log('Page: ', page);
    console.log('Limit: ', limit);
    console.log('Organization User ID: ', metadata.organizationId);
    console.log('User ID: ', req['user'].userId);
    return await this.activityService.findUnreportedActivitiesForCurrentUser(
      req['user'].userId,
      metadata.organizationId,
      date,
      metadata.timezoneRegion,
      sortOrder,
      parseInt(page),
      parseInt(limit),
    );
  }

  @UseGuards(AccessTokenGuard)
  @Post('unreported/assign-to-project')
  @ApiOperation({ summary: 'Assign activities to a worksheet' })
  async assignActivitiesToWorksheet(
    @Req() req: any,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Body() assignActivitiesDto: AssignActivitiesDto,
  ) {
    const userId = req.user.userId;

    return await this.worksheetService.assignActivitiesToWorksheet(
      userId,
      metadata.organizationId,
      assignActivitiesDto,
    );
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('worksheet/get-names')
  @ApiOperation({ summary: 'Get worksheet names and reported time' })
  @ApiResponse({ status: 200, description: 'List of worksheet names' })
  async getWorksheetNames(
    @Req() req: any,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Query() query: WorksheetGetNamesQueryDto,
  ) {
    const userId = req.user.userId;

    return await this.worksheetService.getWorksheetNames(
      userId,
      metadata.organizationId,
      query['project-id'],
      query.name,
      query.date,
    );
  }

  @Get('worksheet/list')
  @ApiOperation({ summary: 'Get list of worksheets' })
  @ApiResponse({ status: 200, description: 'List of worksheets' })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async getWorksheets(
    @Req() req: any,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('start-date') startDate?: string,
    @Query('end-date') endDate?: string,
    @Query('sort-order') sortOrder: 'latest' | 'oldest' = 'latest',
  ) {
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
      metadata.organizationId,
      parseInt(page, 10),
      parseInt(limit, 10),
      sortOrder,
      startDate,
      endDate,
    );
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('worksheet/:worksheetId')
  @ApiOperation({ summary: 'Get activities in a worksheet' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of activities in the worksheet',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized access' })
  async getActivitiesInWorksheet(
    @Req() req: any,
    @RequestMetadata() metadata: RequestMetadataDto,
    @Param('worksheetId') worksheetId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort-order') sortOrder: 'latest' | 'oldest' = 'latest',
  ) {
    const userId = req.user.userId;

    return this.worksheetService.getActivitiesForWorksheet(
      userId,
      metadata.organizationId,
      worksheetId,
      metadata.timezoneRegion,
      parseInt(page),
      parseInt(limit),
      sortOrder,
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
