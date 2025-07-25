import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { of, throwError } from 'rxjs';
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

  const mockGitQueue = {
    addBulk: jest.fn(),
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

    describe('getContributions', () => {
      it('should return getContributions', async () => {
        jest.spyOn(mockGitContributionModel, 'aggregate').mockResolvedValueOnce([{}]);
        const result = await service.getContributions(
          '670f5cb7fcec534287bf881a',
          new Date().toISOString(),
          1,
          10,
        );
        expect(result).toEqual({});
      });
    });

    describe('getLinesChanged', () => {
      const mockCommit = { sha: 'abc123' };
      const mockCommitResponse = {
        data: {
          html_url: 'https://github.com/test-org/test-repo/commit/abc123',
          stats: {
            additions: 10,
            deletions: 5,
            total: 15,
          },
          commit: {
            author: {
              date: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      it('should fetch commit details and return parsed stats', async () => {
        mockHttpService.get.mockReturnValueOnce(of(mockCommitResponse));

        const result = await service.getLinesChanged(
          mockCommit,
          'https://api.github.com/repos/test-org/test-repo/commits',
        );

        expect(result).toEqual({
          totalAdditions: 10,
          totalDeletions: 5,
          totalChanges: 15,
          diff: 5,
          commitHomeUrl: 'https://github.com/test-org/test-repo/commit/abc123',
          commitDate: '2024-01-01T00:00:00Z',
        });
      });

      it('should handle errors and return default values', async () => {
        const mockError = {
          response: {
            data: 'GitHub API error',
          },
        };

        mockHttpService.get.mockReturnValueOnce(throwError(() => mockError));
        const loggerSpy = jest.spyOn(service['logger'], 'error'); // optional

        const result = await service.getLinesChanged(
          mockCommit,
          'https://api.github.com/repos/test-org/test-repo/commits',
        );

        expect(result).toEqual({
          totalAdditions: 0,
          totalDeletions: 0,
          totalChanges: 0,
          diff: 0,
          commitHomeUrl: '',
          commitDate: '',
        });

        expect(loggerSpy).toHaveBeenCalledWith(
          `Error fetching details for commit abc123:`,
          'GitHub API error',
        );
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

    describe('getCommitsByBranch', () => {
      const fakeRepoId = '60f7a16f4b1c2c3a8c4b7a20';
      const mockGitRepo = {
        _id: fakeRepoId,
        organization: 'test-org',
        repo: 'test-repo',
        user: 'test-user',
      };

      const mockCommits = [{ sha: 'abc123' }, { sha: 'def456' }];

      const mockLineStats = {
        totalAdditions: 10,
        totalDeletions: 2,
        totalChanges: 12,
        diff: 8,
        commitHomeUrl: 'https://github.com/test-org/test-repo/commit/abc123',
        commitDate: '2024-01-01T00:00:00Z',
      };

      beforeEach(async () => {
        jest.clearAllMocks();

        mockGitRepoModel.findOne.mockResolvedValue(mockGitRepo);

        mockConfigService.get.mockImplementationOnce((key) => {
          if (key === 'GITHUB_TOKEN') return 'mock-token';
          if (key === 'GITHUB_API_URL') return 'https://api.github.com/repos/';
        });

        mockHttpService.get.mockReturnValue(of({ data: mockCommits }));

        jest.spyOn(service, 'getLinesChanged').mockImplementationOnce(async () => mockLineStats);

        mockGitContributionModel.findOneAndUpdate = jest.fn().mockResolvedValue({});
      });

      it('should fetch commits and store contribution data', async () => {
        await service.getCommitsByBranch(
          'test-user',
          '2024-01-01T00:00:00Z',
          '2024-01-02T00:00:00Z',
          10,
          'main',
          fakeRepoId,
        );

        expect(mockGitRepoModel.findOne).toHaveBeenCalledWith({
          _id: expect.any(Object),
        });
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

    describe('getCommitReport', () => {
      const fakeRepoId = '60f7a16f4b1c2c3a8c4b7a20';
      const mockGitRepo = {
        _id: fakeRepoId,
        organization: 'test-org',
        repo: 'test-repo',
        gitUsername: 'test-user',
      };

      const mockBranches = [{ name: 'main' }, { name: 'dev' }];

      beforeEach(() => {
        jest.clearAllMocks();

        mockGitRepoModel.findOne.mockResolvedValue(mockGitRepo);
        service.getBranches = jest.fn().mockResolvedValue(mockBranches);
        mockGitQueue.addBulk = jest.fn().mockResolvedValue(true);
      });

      it('should return success and queue jobs for each branch', async () => {
        const result = await service.getCommitReport(fakeRepoId);

        expect(mockGitRepoModel.findOne).toHaveBeenCalledWith({
          _id: expect.any(Object),
        });

        expect(result).toEqual({ success: true });
      });

      it('should not queue jobs if no branches found', async () => {
        service.getBranches = jest.fn().mockResolvedValue([]);
        const result = await service.getCommitReport(fakeRepoId);
        expect(result).toBeUndefined();
      });
    });

    describe('addToQueueForCommits', () => {
      const mockGitRepos = [
        { _id: 'repoId1', gitUsername: 'user1' },
        { _id: 'repoId2', gitUsername: 'user2' },
      ];

      beforeEach(() => {
        jest.clearAllMocks();
        mockGitQueue.addBulk = jest.fn().mockResolvedValue(true);
      });

      it('should queue a job for each gitRepo and return the repos', async () => {
        const result = await service.addToQueueForCommits(mockGitRepos);

        expect(result).toEqual(mockGitRepos);
      });

      it('should not call addBulk if gitRepos is empty', async () => {
        const result = await service.addToQueueForCommits([]);

        expect(mockGitQueue.addBulk).not.toHaveBeenCalled();
        expect(result).toEqual([]);
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
