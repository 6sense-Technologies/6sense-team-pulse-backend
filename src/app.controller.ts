import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getServerTime() {
    const serverTime = new Date().toISOString();
    return { serverTime };
  }
}
