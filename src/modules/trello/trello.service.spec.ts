import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from 'src/schemas/user.schema';
import { UserService } from '../users/users.service';
import { TrelloService } from './trello.service';

describe('TrelloService', () => {
  let service: TrelloService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrelloService,
        {
          provide: HttpService,
          useValue: {},
        },
        {
          provide: UserService,
          useValue: {},
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TrelloService>(TrelloService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
