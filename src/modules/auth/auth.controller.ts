import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserEmail,
  CreateUserEmailPasswordDTO,
  LoginUserEmailPasswordDTO,
} from './dto/auth.dto';

@Controller('users')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
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
}
