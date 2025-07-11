import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDTO } from './dto/organization.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from 'src/common/request-metadata/getUser.decorator';
import { IUserWithOrganization } from '../users/interfaces/users.interfaces';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Post('create')
  async create(@Body() createOrganizationDTO: CreateOrganizationDTO, @Req() req: Request) {
    return this.organizationService.create(createOrganizationDTO, req['user']?.userId);
  }

  @Auth()
  @ApiBearerAuth()
  @Get('list')
  async list(@GetUser() user: IUserWithOrganization) {
    return this.organizationService.findByUser(user);
  }

  @Get('roles')
  async getRoles() {
    return this.organizationService.findRoles();
  }
}
