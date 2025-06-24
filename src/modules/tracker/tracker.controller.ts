import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, Headers } from '@nestjs/common';
// import { TrackerService } from './tracker.service';
import { ActivityService } from './activity.service';
import { CreateTrackerDto } from './dto/create-tracker.dto';
import { UpdateTrackerDto } from './dto/update-tracker.dto';
import { CreateActivitiesDto } from './dto/create-activities.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('tracker')
export class TrackerController {
  constructor(
    // @InjectQueue('logs')
    // private readonly logsQueue: Queue, // Inject the logs queue
    // private readonly trackerService: TrackerService,
    private readonly activityService: ActivityService,
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

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Post('add-activity-logs')
  async addActivityLogsToQueue(@Body() createActivitiesDto: CreateActivitiesDto, @Req() req: Request) {
    return await this.activityService.addActivityLogsToQueue(
      req['user'].userId,
      createActivitiesDto.organization_id,
      createActivitiesDto.activity_log,
    );
  }

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
  @Get('list-activities/:organizationUserId')
  async findAllActivities(
    @Param('organizationUserId') organizationUserId: string,
    @Query('date') date: string,
    @Headers('X-Timezone-Offset') timezoneOffset: string,
    @Req() req: Request,
  ) {
    console.log('Date: ', date);
    console.log('Timezone Offset: ', timezoneOffset);
    return await this.activityService.findAllActivities(organizationUserId, req['user'].userId, date, timezoneOffset);
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
