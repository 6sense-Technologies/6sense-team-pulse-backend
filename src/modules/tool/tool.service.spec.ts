import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Tool } from 'src/schemas/Tool.schema';
import { ToolName } from 'src/schemas/ToolName.schema';
import { ToolService } from './tool.service';

describe('ToolService', () => {
  let service: ToolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolService,
        {
          provide: getModelToken(Tool.name),
          useValue: {},
        },
        {
          provide: getModelToken(ToolName.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ToolService>(ToolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
