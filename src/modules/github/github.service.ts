import { Injectable, Logger } from '@nestjs/common';
import { CreateGithubDto } from './dto/create-github.dto';
import { UpdateGithubDto } from './dto/update-github.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GitRepo } from '../users/schemas/GitRepo.schema';
import mongoose, { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { GitContribution } from '../users/schemas/GitContribution.schema';
import { DateTime } from 'luxon';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectModel(GitRepo.name) private readonly gitRepoModel: Model<GitRepo>,
    @InjectModel(GitContribution.name)
    private readonly gitContributionModel: Model<GitContribution>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectQueue('git') private gitQueue: Queue,
  ) {
    // Constructor for injecting userModel
  }

  create(createGithubDto: CreateGithubDto) {
    return 'This action adds a new github';
  }

  findAll() {
    return `This action returns all github`;
  }

  async getContributions(userId: string, date: string) {
    const inputDate = new Date(date); // Replace `date` with your input date
    const today = DateTime.fromJSDate(inputDate, {
      zone: 'Asia/Dhaka',
    }).startOf('day');

    // const today = new Date(date);
    // today.setUTCHours(0, 0, 0, 0); // Start of the day in UTC

    const user = await this.userModel.findOne({ accountId: userId });

    return this.gitContributionModel
      .find({
        user: user._id,
        date: today,
      })
      .populate('gitRepo');
  }

  findOne(id: number) {
    return `This action returns a #${id} github`;
  }

  update(id: number, updateGithubDto: UpdateGithubDto) {
    return `This action updates a #${id} github`;
  }

  remove(id: number) {
    return `This action removes a #${id} github`;
  }

  async getLinesChanged(commits, url: string) {
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalChanges = 0;
    let commitHomeUrl = '';

    const token = this.configService.get('GITHUB_TOKEN');
    this.logger.log('commit size: ', commits.length);
    for (const commit of commits) {
      const sha = commit.sha;
      const commitUrl = `${url}/${sha}`;

      try {
        const commitResponse = await firstValueFrom(
          this.httpService.get(`${commitUrl}`, {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }),
        );
        commitHomeUrl = commitResponse.data.html_url;
        totalAdditions = commitResponse.data.stats.additions;
        totalDeletions = commitResponse.data.stats.deletions;
        totalChanges = commitResponse.data.stats.total;

        // const files = commitResponse.data.files || [];

        // files.forEach((file) => {
        //   totalAdditions += file.additions;
        //   totalDeletions += file.deletions;
        //   totalChanges += file.changes;
        // });
      } catch (error) {
        this.logger.error(
          `Error fetching details for commit ${sha}:`,
          error.response ? error.response.data : error.message,
        );
      }
    }
    const diff = totalAdditions - totalDeletions;
    return {
      totalAdditions,
      totalDeletions,
      totalChanges,
      diff,
      commitHomeUrl,
    };
  }

  async getBranches(gitRepo: any) {
    const branchesUrl = `${this.configService.get('GITHUB_API_URL')}${gitRepo.organization}/${gitRepo.repo}/branches`;
    const token = this.configService.get('GITHUB_TOKEN');

    const branchesResponse = await firstValueFrom(
      this.httpService.get(branchesUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }),
    );
    return branchesResponse.data;
  }

  async getCommitReport(repoId: string) {
    const gitRepo = await this.gitRepoModel.findOne({
      _id: new mongoose.Types.ObjectId(repoId),
    });
    const branches = await this.getBranches(gitRepo);
    this.logger.log('branches', branches);

    if (!branches || branches.length == 0) {
      return;
    }

    const token = this.configService.get('GITHUB_TOKEN');
    const url = `${this.configService.get('GITHUB_API_URL')}${gitRepo.organization}/${gitRepo.repo}/commits`;

    const today = DateTime.now().setZone('Asia/Dhaka').startOf('day');

    const yesterday = DateTime.now()
      .setZone('Asia/Dhaka')
      .startOf('day')
      .minus({ days: 1 });
    // const today = new Date();
    // today.setUTCDate(today.getUTCDate() - 1); // Move back one day
    // today.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
    const todayISOString = today.toISO();
    const yesterdayISOString = yesterday.toISO();

    branches.forEach(async (branch) => {
      this.logger.log('Getting Branch Data');
      const params = {
        author: gitRepo.gitUsername,
        since: yesterdayISOString,
        until: todayISOString,
        per_page: 100, // Adjust as needed for more results
        sha: branch.name,
      };
      this.logger.log('params', params);
      const response = await firstValueFrom(
        this.httpService.get(`${url}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: params,
        }),
      );

      const data = await this.getLinesChanged(response.data, url);
      this.logger.log('data', data);
      if (
        data.totalAdditions != 0 ||
        data.totalDeletions != 0 ||
        data.totalChanges != 0
      ) {
        const res = await this.gitContributionModel.findOneAndUpdate(
          {
            dateString: todayISOString,
            gitRepo: gitRepo._id,
            branch: branch.name,
          },
          {
            date: yesterday,
            dateString: yesterdayISOString,
            gitRepo: gitRepo._id,
            user: gitRepo.user,
            branch: branch.name,
            totalAdditions: data.totalAdditions,
            totalDeletions: data.totalDeletions,
            totalChanges: data.totalChanges,
            totalWritten: data.diff,
            commitHomeUrl: data.commitHomeUrl,
          },
          { upsert: true, new: true },
        );
      }
    });

    return { success: true };
  }

  async addToQueueForCommits(gitRepos: any[]) {
    const jobs = [];
    gitRepos.forEach(async (gitRepo) => {
      // this.logger.log(gitRepo.gitUsername);
      // await this.getCommitReport(gitRepo._id.toString());
      jobs.push({
        name: 'get-commit-report',
        data: gitRepo._id.toString(),
        opts: {
          delay: 1000,
          attempts: 2,
          removeOnComplete: true,
        },
      });
    });
    this.logger.log(jobs.length);
    if (jobs.length > 0) await this.gitQueue.addBulk(jobs);
    return gitRepos;
  }

  async getCommits(userId: string) {
    const gitRepos = await this.gitRepoModel.find({ user: userId });
    return await this.addToQueueForCommits(gitRepos);
  }

  @Cron('5 1 * * *', {
    name: 'git_contribution',
    timeZone: 'Asia/Dhaka',
  })
  async cronGitContribution() {
    const gitRepos = await this.gitRepoModel.find();
    await this.addToQueueForCommits(gitRepos);
  }
}
