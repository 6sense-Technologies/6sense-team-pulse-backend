import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserEmail,
  CreateUserEmailPasswordDTO,
  LoginUserEmailPasswordDTO,
  VerifyEmailDto,
} from './dto/auth.dto';
import { AccessTokenGuard } from './guards/accessToken.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { CreateOrganizationDTO } from '../organization/dto/organization.dto';
import { Organization } from '../users/schemas/Organization.schema';
import { OrganizationService } from '../organization/organization.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly organizationService: OrganizationService,
  ) {}
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('check-login')
  async checkLogin() {
    return 'Logged In';
  }
  @Post('register')
  async registerEmailPassword(
    @Body() createUserEmailPasswordDTO: CreateUserEmailPasswordDTO,
  ) {
    return await this.authService.registerEmailPassword(
      createUserEmailPasswordDTO,
    );
  }

  @Post('register/sso')
  async register(@Body() createUserEmail: CreateUserEmail) {
    return await this.authService.registerEmail(createUserEmail);
  }

  @Post('login')
  async loginEmailPassword(
    @Body() loginUserEmailPasswordDTO: LoginUserEmailPasswordDTO,
  ) {
    return await this.authService.loginEmailPassword(loginUserEmailPasswordDTO);
  }

  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @Post('refresh')
  refreshTokens(@Req() req: Request) {
    const refreshToken: string = req['user'].refreshToken;
    return this.authService.generateRefreshTokens(refreshToken);
  }

  @Post('register/verify-email')
  verifyEmail(@Body() verifyEmailDTO: VerifyEmailDto) {
    return this.authService.verifyToken(verifyEmailDTO);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Post('register/organization')
  createOrganization(
    @Body() createOrganizationDTO: CreateOrganizationDTO,
    @Req() req: Request,
  ) {
    console.log(req['user']);
    return this.organizationService.create(
      createOrganizationDTO,
      req['user'].userId,
    );
  }

  @Get('user-status')
  checkStatus(@Query('email') emailAddress: string) {
    return this.authService.checkStatus(emailAddress);
  }
}
