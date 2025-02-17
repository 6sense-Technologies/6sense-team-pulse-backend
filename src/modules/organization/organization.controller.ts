import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDTO } from './dto/organization.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Post('create')
  async create(
    @Body() createOrganizationDTO: CreateOrganizationDTO,
    @Req() req: Request,
  ) {
    return this.organizationService.create(
      createOrganizationDTO,
      req['user']?.userId,
    );
  }
  @Get('roles')
  async getRoles() {
    return this.organizationService.findRoles();
  }
}
