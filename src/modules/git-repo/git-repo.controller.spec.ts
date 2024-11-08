import { Test, TestingModule } from '@nestjs/testing';
import { GitRepoController } from './git-repo.controller';
import { GitRepoService } from './git-repo.service';

describe('GitRepoController', () => {
  let controller: GitRepoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitRepoController],
      providers: [GitRepoService],
    }).compile();

    controller = module.get<GitRepoController>(GitRepoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
