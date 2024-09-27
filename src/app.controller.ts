import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getServerTime(): { serverTime: string } {
    const serverTime = new Date().toISOString();
    return { serverTime };
  }
}
