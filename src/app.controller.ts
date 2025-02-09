import { Controller, Get } from '@nestjs/common';
import * as os from 'os';
@Controller()
export class AppController {
  @Get()
  getServerTime(): { serverTime: string } {
    const serverTime = new Date().toISOString();
    return { serverTime };
  }
  @Get('cpu-usage')
  getCpuUsage(): any {
    const usage = process.cpuUsage();
    const cpuUsage =
      (usage.user + usage.system) / (os.cpus().length * 1000 * 1000);
    return { cpuUsage: cpuUsage };
  }

  @Get('memory-usage')
  getMemoryUsage(): any {
    const usage = process.memoryUsage();
    const heapUsedInMB = usage.heapUsed / (1024 * 1024); // Convert bytes to MB
    const heapTotalInMB = usage.heapTotal / (1024 * 1024); // Convert bytes to MB
    const memoryUsage = heapUsedInMB; // Return heapUsed in MB
    return {
      memoryUsage: memoryUsage,
      heapUsedInMB: heapUsedInMB,
      heapTotalInMB: heapTotalInMB,
    };
  }
}
