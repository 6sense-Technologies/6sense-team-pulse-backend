import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDTO } from './dto/auth.dto';

@Controller('usersv2')
export class AuthController {
  constructor(private readonly authService:AuthService){}
  @Post('registration')
  async register(@Body() createUserDTO:CreateUserDTO) {
    return  await this.authService.register(createUserDTO)
  }

}
