import { Controller, Post } from '@nestjs/common';
import { DataFetcherService } from './data-fetcher.service';

@Controller('data-fetcher')
export class DataFetcherController {
  constructor(private readonly dataFetcherService: DataFetcherService) {}

  @Post('fetch-for-today')
  async getAllData() {
    // Return response early
    setTimeout(() => {
      this.dataFetcherService.fetchDataFromAllToolUrls();
    }, 0);

    return { message: 'Processing' };
  }
}
