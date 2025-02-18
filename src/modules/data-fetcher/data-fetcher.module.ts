import { Module } from '@nestjs/common';
import { DataFetcherService } from './data-fetcher.service';
import { HttpModule } from '@nestjs/axios';
import { DataFetcherController } from './data-fetcher.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Tool, ToolSchema } from '../users/schemas/Tool.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tool.name, schema: ToolSchema }]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [DataFetcherService],
  controllers: [DataFetcherController],
})
export class DataFetcherModule {}
