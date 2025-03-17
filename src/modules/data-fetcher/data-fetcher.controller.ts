import { Controller, Get, Post } from '@nestjs/common';
import { DataFetcherService } from './data-fetcher.service';

@Controller('data-fetcher')
export class DataFetcherController {
  constructor(private readonly dataFetcherService: DataFetcherService) {}

  @Get('fetch-for-today')
  async getAllData() {
    // Return response early
    setTimeout(() => {
      this.dataFetcherService.fetchDataFromAllToolUrls();
    }, 0);

    return { message: 'Processing' };
  }

  @Get('fetch-for-last-week')
  async getLastWeekData() {
    setTimeout(() => {
      this.dataFetcherService.fetchDataFromAllToolUrls(true);
    });
    return { message: 'Processing' };
  }
}
