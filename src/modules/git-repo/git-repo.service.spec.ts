import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { GitRepo } from 'src/schemas/GitRepo.schema';
import { GitRepoService } from './git-repo.service';

describe('GitRepoService', () => {
  let service: GitRepoService;
  let model: any;

  const mockGitRepo = {
    _id: 'mock-id',
    provider: 'github',
    user: new mongoose.Types.ObjectId(),
    organization: 'my-org',
    repo: 'my-repo',
    gitUsername: 'john-doe',
  };

  beforeEach(async () => {
    const mockModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockGitRepo]),
      findOne: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockGitRepo),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(mockGitRepo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitRepoService,
        {
          provide: getModelToken(GitRepo.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<GitRepoService>(GitRepoService);
    model = module.get(getModelToken(GitRepo.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a GitRepo document', async () => {
      const dto = {
        provider: 'github',
        user: mockGitRepo.user.toHexString(),
        organization: 'my-org',
        repo: 'my-repo',
        gitUsername: 'john-doe',
      };

      model.create.mockResolvedValue(mockGitRepo);

      const result = await service.create(dto);
      expect(model.create).toHaveBeenCalledWith({
        provider: dto.provider,
        user: new mongoose.Types.ObjectId(dto.user),
        organization: dto.organization,
        repo: dto.repo,
        gitUsername: dto.gitUsername,
      });
      expect(result).toEqual(mockGitRepo);
    });
  });

  describe('findAll', () => {
    it('should return paginated GitRepo documents', async () => {
      const result = await service.findAll(1, 10);
      expect(model.find).toHaveBeenCalled();
      expect(model.skip).toHaveBeenCalledWith(0);
      expect(model.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockGitRepo]);
    });
  });

  describe('findOne', () => {
    it('should return a single GitRepo by id with user populated', async () => {
      const result = await service.findOne('mock-id');
      expect(model.findOne).toHaveBeenCalledWith({ _id: 'mock-id' });
      expect(result).toEqual(mockGitRepo);
    });
  });

  describe('update', () => {
    it('should update a GitRepo document', async () => {
      const dto = {
        provider: 'gitlab',
        organization: 'new-org',
        repo: 'new-repo',
        gitUsername: 'new-user',
      };

      const result = await service.update('mock-id', dto);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mock-id' },
        dto,
      );
      expect(result).toEqual(mockGitRepo);
    });

    it('should not include undefined fields in update', async () => {
      const dto = {
        organization: 'partial-org',
      };

      await service.update('mock-id', dto);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mock-id' },
        { organization: 'partial-org' },
      );
    });
  });
});
