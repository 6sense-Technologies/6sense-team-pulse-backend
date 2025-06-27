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
  BadRequestException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { WorksheetService } from '../tracker/worksheet.service';
import { WorksheetListOfProjectQueryDto } from './dto/worksheet-list-of-project.query.dto';
import { isValidObjectId } from 'mongoose';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly worksheetService: WorksheetService,
  ) {}

  @Get('worksheet-list')
  @ApiOperation({
    summary: "Get all worksheets of a project's members",
  })
  @ApiBearerAuth()
  @Auth(['admin']) // You can add role-based check here if needed
  @ApiQuery({ name: 'projectId', type: String, required: true })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({
    name: 'start-date',
    type: String,
    required: false,
    example: '2025-05-01',
  })
  @ApiQuery({
    name: 'end-date',
    type: String,
    required: false,
    example: '2025-05-22',
  })
  @ApiQuery({
    name: 'sort-by',
    enum: ['duration', 'reportedTime'],
    required: false,
    example: 'reportedTime',
  })
  @ApiQuery({
    name: 'sort-order',
    enum: ['oldest', 'latest'],
    required: false,
    example: 'latest',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    example: 'sprint planning',
  })
  @ApiResponse({
    status: 200,
    description: 'List of worksheets by project members',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProjectMemberWorksheets(@Req() req: any, @Query() query: WorksheetListOfProjectQueryDto): Promise<any> {
    const organizationId = req.user.organizationId;

    return this.worksheetService.getProjectMemberWorksheets(
      query['project-id'],
      organizationId,
      query.page,
      query.limit,
      query['sort-by'],
      query['sort-order'],
      query['start-date'],
      query['end-date'],
      query.search,
    );
  }

  @Get('worksheet-analytics')
  @ApiOperation({
    summary: "Get analytics of a project's worksheets",
  })
  @ApiBearerAuth()
  @Auth(['admin']) // You can add role-based check here if needed
  @ApiQuery({ name: 'projectId', type: String, required: true })
  async getProjectWorksheetAnalytics(
    @RequestMetadata() requestMetadata: RequestMetadataDto,
    @Req() req: any,
    @Query('project-id') projectId: string,
  ): Promise<any> {
    if (!projectId || !projectId.trim() || !isValidObjectId(projectId)) {
      throw new BadRequestException('Invalid/Missing project ID');
    }

    const organizationId = req.user.organizationId;

    return this.worksheetService.getProjectWorksheetAnalytics(
      projectId,
      organizationId,
      requestMetadata.timezoneRegion,
    );
  }

  @Auth(['admin'])
  @ApiBearerAuth()
  @Get('worksheet-details/:worksheetId')
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
  async getActivitiesForWorksheetAsAdmin(
    @Req() req: any,
    @Param('worksheetId') worksheetId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort-order') sortOrder: 'latest' | 'oldest' = 'latest',
    @Query('search') search?: string,
  ): Promise<any> {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const isAdmin = true;

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

  @Auth()
  @ApiBearerAuth()
  @Get('names')
  findProjectNames(@Req() req: Request) {
    return this.projectsService.getNames(req['user'].userId, req['user'].organizationId);
  }

  @Auth(['admin'])
  @ApiBearerAuth()
  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Req() req: Request) {
    return this.projectsService.create(createProjectDto, req['user'].userId, req['user'].organizationId);
  }

  @Auth()
  @ApiBearerAuth()
  @Get()
  findAll(@Req() req: Request, @Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.projectsService.findAll(+page, +limit, req['user'].userId, req['user'].organizationId);
  }

  // @Auth()
  // @ApiBearerAuth()
  // @Get('get-user-projects-by-organization')
  // async getUserProjectsByOrganization(@Req() req: Request) {
  //   return await this.projectsService.getUserProjectsByOrganization(
  //     req['user'].userId,
  //     req['user'].organizationId,
  //   );
  // }

  @ApiBearerAuth()
  @Auth()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    console.log(id);
    return this.projectsService.findOne(id, req['user'].userId, req['user'].organizationId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
