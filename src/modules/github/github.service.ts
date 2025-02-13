import { Injectable, Logger } from '@nestjs/common';
import { CreateGithubDto } from './dto/create-github.dto';
import { UpdateGithubDto } from './dto/update-github.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GitRepo } from '../users/schemas/GitRepo.schema';
import mongoose, { Model, Types } from 'mongoose';
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
  async getChart(userId: string, date: string) {
    console.log(`UserId: ${userId} Date: ${date}`);
    return 'To be implemented';
  }
  create(createGithubDto: CreateGithubDto) {
    return 'This action adds a new github';
  }

  findAll() {
    return `This action returns all github`;
  }

  async getContributions(
    userId: string,
    date: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const inputDate = new Date(date); // Replace `date` with your input date
    const dateStart = DateTime.fromJSDate(inputDate, {
      zone: 'Asia/Dhaka',
    }).startOf('day');

    const dateEnd = DateTime.fromJSDate(inputDate, {
      zone: 'Asia/Dhaka',
    }).endOf('day');

    // const today = new Date(date);
    // today.setUTCHours(0, 0, 0, 0); // Start of the day in UTC

    const gitContributions = this.gitContributionModel
      .find({
        user: new Types.ObjectId(userId),
        date: { $gte: dateStart, $lte: dateEnd },
      })
      .populate('gitRepo');
    const results = this.gitContributionModel.aggregate([
      {
        $facet: {
          // Sub-pipeline for summarized results (totals)
          summary: [
            {
              $group: {
                _id: null,
                totalAdditionsSum: { $sum: '$totalAdditions' },
                totalDeletionsSum: { $sum: '$totalDeletions' },
                totalContributions: { $sum: '$totalChanges' },
                totalWrittenSum: { $sum: '$totalWritten' },
              },
            },
            {
              $project: {
                totalAdditionsSum: 1,
                totalDeletionsSum: 1,
                totalContributions: 1,
                totalWrittenSum: 1,
                codeChurn: {
                  $cond: [
                    { $eq: ['$totalWrittenSum', 0] }, // Check if totalWrittenSum is 0
                    0, // If true, return 0 to avoid division by zero
                    { $divide: ['$totalDeletionsSum', '$totalWrittenSum'] }, // Otherwise, perform the division
                  ],
                },
              },
            },
          ],
          // Sub-pipeline for paginated individual entries
          data: [
            { $skip: (page - 1) * limit }, // Skip documents for pagination
            { $limit: limit }, // Limit the number of documents per page
            {
              $lookup: {
                from: 'gitrepos', // The collection to join with
                localField: 'gitRepo', // Field from the gitContributions collection
                foreignField: '_id', // Field from the GitRepo collection
                as: 'gitRepoDetails', // Output array field
              },
            },
            {
              $unwind: '$gitRepoDetails', // Unwind the joined array (since $lookup returns an array)
            },
            {
              $project: {
                totalAdditions: 1,
                totalDeletions: 1,
                totalChanges: 1,
                totalWritten: 1,
                commitHomeUrl: 1,
                branch: 1,
                repo: '$gitRepoDetails.repo', // Include the repo field from the joined collection
                project: '$gitRepoDetails.project', // Include the project field from the joined collection
                gitUsername: '$gitRepoDetails.gitUsername', // Include the gitUsername field from the joined collection
                // Add any other fields you need here
              },
            },
          ],
          // Sub-pipeline for total count of documents
          totalCount: [
            { $count: 'total' }, // Count total number of documents
          ],
        },
      },
      {
        $project: {
          // Extract the first element from the summary array
          summary: { $arrayElemAt: ['$summary', 0] },
          // Extract the first element from the totalCount array
          totalCount: { $arrayElemAt: ['$totalCount.total', 0] },
          // Keep the data array as is
          data: 1,
        },
      },
    ]);
    return results;
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

  async getLinesChanged(commit, url: string) {
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalChanges = 0;
    let commitHomeUrl = '';
    let commitDate = '';

    const token = this.configService.get('GITHUB_TOKEN');
    // this.logger.log('commit size: ', commits.length);
    // for (const commit of commits) {
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
      commitDate = commitResponse.data.commit.author.date;
      this.logger.log('commitResponse.data');
      this.logger.log(commitResponse.data);
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
    // }
    const diff = totalAdditions - totalDeletions;

    return {
      totalAdditions,
      totalDeletions,
      totalChanges,
      diff,
      commitHomeUrl,
      commitDate,
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

  async getCommitsByBranch(
    author: string,
    since: string,
    until: string,
    per_page: number,
    sha: string,
    repoId: string,
  ) {
    const gitRepo = await this.gitRepoModel.findOne({
      _id: new mongoose.Types.ObjectId(repoId),
    });
    const token = this.configService.get('GITHUB_TOKEN');
    const url = `${this.configService.get('GITHUB_API_URL')}${gitRepo.organization}/${gitRepo.repo}/commits`;

    const params = {
      author: author,
      since: since,
      until: until,
      per_page: per_page, // Adjust as needed for more results
      sha: sha,
    };

    this.logger.log('params');
    this.logger.log(params);
    const response = await firstValueFrom(
      this.httpService.get(`${url}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: params,
      }),
    );

    if (response.data) {
      this.logger.log(`branch response data: ${response.data}`);

      response.data.forEach(async (commit) => {
        const data = await this.getLinesChanged(commit, url);

        if (
          data.totalAdditions != 0 ||
          data.totalDeletions != 0 ||
          data.totalChanges != 0
        ) {
          this.logger.log(`data:`);
          this.logger.log(data);
          const res = await this.gitContributionModel.findOneAndUpdate(
            {
              dateString: data.commitDate,
              gitRepo: gitRepo._id,
              branch: sha,
              commitHomeUrl: data.commitHomeUrl,
            },
            {
              date: new Date(data.commitDate),
              dateString: data.commitDate,
              gitRepo: gitRepo._id,
              user: gitRepo.user,
              branch: sha,
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
    }
  }

  async getCommitReport(repoId: string) {
    const gitRepo = await this.gitRepoModel.findOne({
      _id: new mongoose.Types.ObjectId(repoId),
    });
    const branches = await this.getBranches(gitRepo);
    this.logger.log('branches');
    this.logger.log(branches);

    if (!branches || branches.length == 0) {
      return;
    }

    const jobs = [];
    const today = DateTime.now().setZone('Asia/Dhaka').startOf('day');
    const yesterday = DateTime.now()
      .setZone('Asia/Dhaka')
      .startOf('day')
      .minus({ days: 1 });
    branches.forEach(async (branch) => {
      // this.logger.log(gitRepo.gitUsername);
      // await this.getCommitReport(gitRepo._id.toString());
      jobs.push({
        name: 'get-commits-by-branch',
        data: {
          author: gitRepo.gitUsername,
          since: yesterday.toISO(),
          until: today.toISO(),
          per_page: 100, // Adjust as needed for more results
          sha: branch.name,
          repoId: repoId,
        },
        opts: {
          delay: 1000,
          attempts: 2,
          removeOnComplete: true,
        },
      });
    });
    this.logger.log(jobs.length);
    if (jobs.length > 0) await this.gitQueue.addBulk(jobs);

    // // const today = new Date();
    // // today.setUTCDate(today.getUTCDate() - 1); // Move back one day
    // // today.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
    // const todayISOString = today.toISO();
    // const yesterdayISOString = yesterday.toISO();

    // branches.forEach(async (branch) => {
    //   this.logger.log('Getting Branch Data');
    // const params = {
    //   author: gitRepo.gitUsername,
    //   since: yesterdayISOString,
    //   until: todayISOString,
    //   per_page: 100, // Adjust as needed for more results
    //   sha: branch.name,
    // };
    // this.logger.log('params', params);
    // const response = await firstValueFrom(
    //   this.httpService.get(`${url}`, {
    //     headers: {
    //       Authorization: `token ${token}`,
    //       Accept: 'application/vnd.github.v3+json',
    //     },
    //     params: params,
    //   }),
    // );

    //   if (response.data) {
    // response.data.forEach(async (commit) => {
    //   const data = await this.getLinesChanged(commit, url);

    //   if (
    //     data.totalAdditions != 0 ||
    //     data.totalDeletions != 0 ||
    //     data.totalChanges != 0
    //   ) {
    //     this.logger.log('data', data);
    //     const res = await this.gitContributionModel.findOneAndUpdate(
    //       {
    //         dateString: data.commitDate,
    //         gitRepo: gitRepo._id,
    //         branch: branch.name,
    //         commitHomeUrl: data.commitHomeUrl,
    //       },
    //       {
    //         date: new Date(data.commitDate),
    //         dateString: data.commitDate,
    //         gitRepo: gitRepo._id,
    //         user: gitRepo.user,
    //         branch: branch.name,
    //         totalAdditions: data.totalAdditions,
    //         totalDeletions: data.totalDeletions,
    //         totalChanges: data.totalChanges,
    //         totalWritten: data.diff,
    //         commitHomeUrl: data.commitHomeUrl,
    //       },
    //       { upsert: true, new: true },
    //     );
    //   }
    // });
    //   }

    //   // const data = await this.getLinesChanged(response.data, url);
    // });

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
