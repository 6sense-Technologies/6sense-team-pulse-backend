import { Test, TestingModule } from '@nestjs/testing';
import { DataFetcherController } from './data-fetcher.controller';

describe('DataFetcherController', () => {
  let controller: DataFetcherController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataFetcherController],
    }).compile();

    controller = module.get<DataFetcherController>(DataFetcherController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
