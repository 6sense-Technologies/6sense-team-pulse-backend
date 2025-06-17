import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { of } from 'rxjs';
import { GitContribution } from 'src/schemas/GitContribution.schema';
import { GitRepo } from 'src/schemas/GitRepo.schema';
import { User } from 'src/schemas/user.schema';
import { GithubService } from './github.service';

describe('GithubService', () => {
  let service: GithubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubService,
        {
          provide: HttpService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: getModelToken(GitRepo.name),
          useValue: {},
        },
        {
          provide: getModelToken(GitContribution.name),
          useValue: {},
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: getQueueToken('git'),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GithubService>(GithubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'GITHUB_TOKEN') return 'fake-token';
      if (key === 'GITHUB_API_URL') return 'https://api.github.com/repos/';
      return null;
    }),
  };

  const mockGitRepoModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockGitContributionModel = {
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  const mockUserModel = {};
  const mockQueue = {
    addBulk: jest.fn(),
  };

  const mockRepo = {
    _id: new Types.ObjectId(),
    organization: 'test-org',
    repo: 'test-repo',
    user: new Types.ObjectId(),
    gitUsername: 'test-user',
  };

  const mockCommit = {
    sha: 'abc123',
  };

  const mockCommitResponse = {
    data: {
      html_url: 'http://github.com/commit/abc123',
      stats: {
        additions: 10,
        deletions: 5,
        total: 15,
      },
      commit: {
        author: {
          date: new Date().toISOString(),
        },
      },
    },
  };

  describe('GithubService', () => {
    let service: GithubService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GithubService,
          { provide: HttpService, useValue: mockHttpService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getModelToken(GitRepo.name), useValue: mockGitRepoModel },
          {
            provide: getModelToken(GitContribution.name),
            useValue: mockGitContributionModel,
          },
          { provide: getModelToken(User.name), useValue: mockUserModel },
          { provide: getQueueToken('git'), useValue: mockQueue },
        ],
      }).compile();

      service = module.get<GithubService>(GithubService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    describe('summary', () => {
      it('should return summary result', async () => {
        mockGitContributionModel.aggregate.mockResolvedValueOnce([
          {
            summary: {
              totalAdditionsSum: 5,
              totalDeletionsSum: 3,
              totalContributions: 8,
              totalWrittenSum: 2,
              codeChurn: 1.5,
            },
          },
        ]);

        const result = await service.summary(
          '670f5cb7fcec534287bf881a',
          new Date().toISOString(),
          'UTC',
        );
        expect(result.summary.totalAdditionsSum).toBe(5);
      });
    });

    describe('getLinesChanged', () => {
      it('should fetch commit details and return parsed stats', async () => {
        mockHttpService.get.mockReturnValueOnce(of(mockCommitResponse));
        const result = await service.getLinesChanged(
          mockCommit,
          'https://api.github.com/repos/test-org/test-repo/commits',
        );

        expect(result.totalAdditions).toBe(10);
        expect(result.diff).toBe(5);
      });
    });

    describe('getBranches', () => {
      it('should return branch data from GitHub API', async () => {
        const branchData = [{ name: 'main' }];
        mockHttpService.get.mockReturnValueOnce(of({ data: branchData }));

        const result = await service.getBranches(mockRepo as any);
        expect(result).toEqual(branchData);
      });
    });

    describe('getCommits', () => {
      it('should call addToQueueForCommits with user git repos', async () => {
        mockGitRepoModel.find.mockResolvedValueOnce([mockRepo]);
        const addToQueueSpy = jest
          .spyOn(service, 'addToQueueForCommits')
          .mockResolvedValueOnce([mockRepo]);

        const result = await service.getCommits('user-id');
        expect(addToQueueSpy).toHaveBeenCalledWith([mockRepo]);
        expect(result).toEqual([mockRepo]);
      });
    });

    describe('cronGitContribution', () => {
      it('should queue jobs for all git repos', async () => {
        mockGitRepoModel.find.mockResolvedValueOnce([mockRepo]);
        const addToQueueSpy = jest
          .spyOn(service, 'addToQueueForCommits')
          .mockResolvedValueOnce([mockRepo]);

        await service.cronGitContribution();
        expect(addToQueueSpy).toHaveBeenCalledWith([mockRepo]);
      });
    });
  });
});
