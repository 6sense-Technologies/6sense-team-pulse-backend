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
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}
  @UseGuards(RolesGuard)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Roles(['Admin', 'Member'])
  @Get('names')
  findProjectNames(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    console.log(`USERID: ${req['user'].userId}`);
    return this.projectsService.getNames(+page, +limit, req['user'].userId);
  }
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Roles(['Admin'])
  @UseGuards(RolesGuard)
  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Req() req: Request) {
    return this.projectsService.create(createProjectDto, req['user'].userId);
  }
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Roles(['Admin', 'Member'])
  @UseGuards(RolesGuard)
  @Get()
  findAll(
    @Req() req: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.projectsService.findAll(+page, +limit, req['user'].userId);
  }

  @Auth()
  @ApiBearerAuth()
  @Get('get-user-projects-by-organization')
  async getUserProjectsByOrganization(
    @Req() req: Request,
  ) {
    return await this.projectsService.getUserProjectsByOrganization(
      req['user'].userId,
      req['user'].organizationId,
    );
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(['Admin', 'Member'])
  @Get(':id')
  findOne(@Param('id') id: string) {
    console.log(id);
    return this.projectsService.findOne(id);
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
