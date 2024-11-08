import { Test, TestingModule } from '@nestjs/testing';
import { GitRepoService } from './git-repo.service';

describe('GitRepoService', () => {
  let service: GitRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitRepoService],
    }).compile();

    service = module.get<GitRepoService>(GitRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
