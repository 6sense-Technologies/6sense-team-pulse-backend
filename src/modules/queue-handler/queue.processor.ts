import { Processor, OnWorkerEvent, OnQueueEvent, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GithubService } from '../github/github.service';

@Processor('git')
export class GitConsumer extends WorkerHost {
  private readonly logger = new Logger(GitConsumer.name);

  constructor(private readonly githubService: GithubService) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name} with data ${job.data}...`);
  }

  @OnQueueEvent('active')
  onEventActive(job: { jobId: string; prev?: string }) {
    this.logger.log(`Processing job ${job.jobId}...`);
  }

  @OnQueueEvent('waiting')
  onWaiting(jobId: string) {
    this.logger.log(`Job ${jobId} is waiting to be processed.`);
  }

  @OnQueueEvent('delayed')
  onDelayed(job: Job) {
    this.logger.log(`Job ${job.id} is delayed.`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed!`);
  }

  async process(job: Job<any>) {
    switch (job.name) {
      case 'get-commit-report':
        await this.getCommitReport(job.data);
        break;
      case 'get-commits-by-branch':
        this.logger.log(`Processing ${job.data.sha} branch`);
        await this.getCommitsByBranch(job.data);
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        break;
    }
    this.logger.log(`Processing ${job.name} job with data:`, job.data);
  }

  async getCommitReport(repoId: string) {
    await this.githubService.getCommitReport(repoId);
  }

  async getCommitsByBranch(data: {
    author: string;
    since: string;
    until: string;
    per_page: number;
    sha: string;
    repoId: string;
  }) {
    return this.githubService.getCommitsByBranch(
      data.author,
      data.since,
      data.until,
      data.per_page,
      data.sha,
      data.repoId,
    );
  }
}
