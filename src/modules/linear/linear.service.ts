import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateLinearDto } from './dto/create-linear.dto';
import { UpdateLinearDto } from './dto/update-linear.dto';
import { ConfigService } from '@nestjs/config';
import { ToolService } from '../tool/tool.service';
import { LinearClient } from '@linear/sdk';
import { DateTime } from 'luxon';
import { Model, Types } from 'mongoose';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { InjectModel } from '@nestjs/mongoose';
import { LINEAR_ISSUE_QUERY } from './linear.queries';

@Injectable()
export class LinearService {
  constructor(
    private readonly configService: ConfigService,
    private readonly toolService: ToolService,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
  ) {}

  async linearToolValidation(toolId: string) {
    if (!toolId || toolId.trim() === '') {
      throw new BadRequestException('Tool ID is required');
    }
    const tool = await this.toolService.getToolById(toolId);
    if (!tool) {
      throw new NotFoundException(`Tool with ID not found`);
    }
    if (tool.toolName.toLowerCase() !== 'linear') {
      throw new BadRequestException('Tool is not Linear');
    }
    if (tool.accessToken) {
      throw new BadRequestException('Tool is already connected');
    }
    return tool;
  }

  async connect(toolId: string, origin: string) {
    await this.linearToolValidation(toolId);
    // // Redirect user to Linear OAuth authorization URL
    const clientId = this.configService.getOrThrow<string>('LINEAR_CLIENT_ID');
    const redirectUri = origin + '/linear/callback';
    const state = 'SECURE_RANDOM';
    const scope = 'read';
    const url = `https://linear.app/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
    return url;
  }

  async handleCallback(code: string, toolId: string, origin: string) {
    try {
      // Validate input
      if (!code || code.trim() === '') {
        throw new BadRequestException('Authorization code is required');
      }

      await this.linearToolValidation(toolId);

      const clientId = this.configService.getOrThrow<string>('LINEAR_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('LINEAR_CLIENT_SECRET');
      const redirectUri = origin + '/linear/callback';

      const params = new URLSearchParams();
      params.append('code', code);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('grant_type', 'authorization_code');

      const response = await fetch('https://api.linear.app/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error_description || errorData.error || (await response.text());
        } catch (err) {
          errorMessage = `Failed to parse error response: ${err.message}`;
        }
        throw new UnauthorizedException(`Failed to exchange code for token: ${errorMessage}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;
      if (!accessToken) {
        throw new UnauthorizedException('Access token not received from Linear');
      }

      await this.toolService.updateToolWithAccessToken(toolId, accessToken);
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        error.getStatus = () => 200; // Ensure we handle known NestJS exceptions
        throw error; // Re-throw known NestJS HTTP exceptions
      }
      // Optionally log error here
      console.error('OAuth callback error:', error);
      throw new InternalServerErrorException('An unexpected error occurred during OAuth callback.');
    }
  }

  async fetchAndSaveIssuesFromLinear(date: string = new Date().toISOString().split('T')[0]) {
    const tools = await this.toolService.getLinearToolsWithUsers();

    const allToolUserTasks = tools.flatMap((tool) => {
      const linearClient = new LinearClient({ accessToken: tool.accessToken });

      return tool.users.map(async (user) => {
        const email = user.emailAddress;

        try {
          const res = await linearClient.client.rawRequest(LINEAR_ISSUE_QUERY, {
            dueDate: date,
            email,
          });

          // Log Linear API rate limit headers for debugging
          // console.log(
          //   'X-RateLimit-Requests-> Limit, Remaining, Reset:',
          //   res.headers.get('x-ratelimit-requests-limit'),
          //   res.headers.get('x-ratelimit-requests-remaining'),
          //   res.headers.get('x-ratelimit-requests-reset')
          // );

          const issues = res.data['issues'].nodes || [];
          if (!issues || issues.length === 0) {
            console.warn(`No issues found for ${email} on ${date}`);
            return;
          }

          console.log(`Found ${issues.length} issues for ${email} on ${date}`);

          const bulkOps = await this.buildBulkUpdateOps(
            issues,
            new Types.ObjectId(user._id as string),
            new Types.ObjectId(tool.organization as string),
            res.data['organization'].urlKey,
          );

          if (bulkOps.length > 0) {
            await this.issueEntryModel.bulkWrite(bulkOps);
          }
        } catch (error) {
          console.error(`Error type: ${error.type}`);
          console.error(error);

          if (
            error.type === 'AuthenticationError' ||
            error.message.includes(
              `It looks like you're trying to use an API key as a Bearer token.`,
            )
          ) {
            await this.toolService.removeAccessToken(tool._id);
            console.error(`❌ Authentication error for tool ${tool._id}. Access token removed.`);
          }

          console.error(
            `❌ Failed to fetch Linear issues for ${email}:`,
            error.response?.errors || error.message,
          );
        }
      });
    });

    const results = await Promise.allSettled(allToolUserTasks);

    const failed = results.filter((r) => r.status === 'rejected');
    const succeeded = results.filter((r) => r.status === 'fulfilled');

    console.log(`✅ ${succeeded.length} succeeded, ❌ ${failed.length} failed`);

    return {
      message: `✅ Fetched and saved Linear issues: ${succeeded.length} successful, ${failed.length} failed.`,
    };
  }

  checkPlanned(createdAt: string, dueDate: string, userTimezone: string): boolean {
      const createdDay = createdAt.split('T')[0]; // Extract date (YYYY-MM-DD) from createdAt
      const createdLocalTime = DateTime.fromISO(createdAt).setZone(userTimezone).toISOTime(); // Convert to local time
      // If the created day is earlier than the due date, it's valid
      if (createdDay < dueDate) {
          return true;
      }

      // If the created day is the same as the due date, check if it's before 11:00 AM
      return createdDay === dueDate && createdLocalTime < '11:00:00';
  }

  computeIssueStatus(
    stateType: string,
    completedAt: string | null,
    dueDate: string | null,
  ): string {
    if (!stateType) {
      return 'notStarted';
    }
    if (stateType === 'completed') {
      if (completedAt && dueDate) {
        const completedAtDate = DateTime.fromISO(completedAt).toISODate();
        const dueDateDate = DateTime.fromISO(dueDate).toISODate();
        return completedAtDate <= dueDateDate ? 'completed' : 'lateCompleted';
      }
      return 'completed';
    }
    return stateType || 'notStarted';
  }

  async buildBulkUpdateOps(
    issues: any[],
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
    orgUrlKey: string,
  ) {
    return issues.map((issue) => {
      const isPlanned = this.checkPlanned(
        issue.createdAt,
        issue.dueDate,
        issue.assignee.timezone || 'UTC',
      );

      const relatedIssues = issue.relations.nodes.map((r) => r.issue.identifier);
      const childrenIssues = issue.children.nodes.map((c) => c.identifier);
      const parentIssue = issue.parent ? [issue.parent.identifier] : [];
      const linkedIssues = [...relatedIssues, ...childrenIssues, ...parentIssue];

      const issueStatus = this.computeIssueStatus(
        issue.state?.type,
        issue.completedAt,
        issue.dueDate,
      );

      const hasBugLabel = issue.labels.nodes.some((label) => label.name.toLowerCase() === 'bug');
      const issueType = hasBugLabel ? 'Bug' : 'Task';

      return {
        updateOne: {
          filter: {
            issueId: issue.id,
            user: new Types.ObjectId(userId),
            organization: new Types.ObjectId(organizationId),
          },
          update: {
            $set: {
              serialNumber: 0,
              issueId: issue.id,
              issueType,
              issueStatus,
              issueSummary: issue.title,
              username: issue.assignee.name,
              planned: isPlanned,
              link: '',
              accountId: issue.assignee?.id,
              projectUrl: `https://linear.app/${orgUrlKey}`,
              issueIdUrl: issue.url,
              issueCode: issue.identifier || '',
              issueLinkUrl: '',
              user: new Types.ObjectId(userId),
              organization: new Types.ObjectId(organizationId),
              date: issue.dueDate,
              linkedIssues,
              comment: '',
            },
          },
          upsert: true,
        },
      };
    });
  }

  // create(createLinearDto: CreateLinearDto) {
  //   return 'This action adds a new linear';
  // }

  // findAll() {
  //   return `This action returns all linear`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} linear`;
  // }

  // update(id: number, updateLinearDto: UpdateLinearDto) {
  //   return `This action updates a #${id} linear`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} linear`;
  // }
}
