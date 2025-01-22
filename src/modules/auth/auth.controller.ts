import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('check-login')
  async checkLogin() {
    return 'Logged In';
  }
  @Post('registration')
  async registerEmailPassword(
    @Body() createUserEmailPasswordDTO: CreateUserEmailPasswordDTO,
  ) {
    return await this.authService.registerEmailPassword(
      createUserEmailPasswordDTO,
    );
  }

  @Post('registration-sso')
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
    return this.authService.generateRefreshTokens(refreshToken)
  }

  @Post('verify-email')
  verifyEmail(@Body() verifyEmailDTO:VerifyEmailDto){
    return this.authService.verifyToken(verifyEmailDTO)
  }
  
}
