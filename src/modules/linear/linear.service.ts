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
    const redirectUri = origin;
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
      const redirectUri = origin;

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

  async getLinearTools() {
    const tools = await this.toolService.getLinearToolsWithUsers();
    if (!tools || tools.length === 0) {
      throw new NotFoundException('No Connected Linear tools found');
    }
    return tools;
  }

  async fetchIssuesFromLinear() {
    // const tools = await this.getLinearTools();
    // tools.forEach((tool) => {
    //   const linearClient = new LinearClient({
    //     accessToken: tool.accessToken,
    //   });
    //   const graphQLClient = linearClient.client;
    //   tool['users'].forEach((user) => {
    //     const issues = await graphQLClient.rawRequest(`...`,
    //       { id: 'cycle-id' },
    //     );
    //   });
    // });
  }

  async fetchAndSaveIssuesFromLinear(date: string = new Date().toISOString().split('T')[0]) {

    const LINEAR_ISSUE_QUERY = `
      query GetTasksByDate($dueDate: TimelessDateOrDuration, $email: String) {
        organization {
          urlKey
        }
        issues(
          filter: {
            dueDate: { eq: $dueDate }
            assignee: { email: { eq: $email } }
          }
        ) {
          nodes {
            id
            title
            dueDate
            completedAt
            url
            identifier
            state {
              type
            }
            assignee {
              id
              name
              timezone
            }
            createdAt
            updatedAt

            parent {
              identifier
            }
            
            relations{
              nodes{
                issue{
                  identifier
                }
              }
            }
            
            children{
              nodes{
                identifier
              }
            }

          }
        }
      }
    `;

    const tools = await this.toolService.getLinearToolsWithUsers();
    const allIssues = [];

    for (const tool of tools) {
      const linearClient = new LinearClient({
        accessToken: tool.accessToken,
      });

      for (const user of tool.users) {
        const email = user.emailAddress;
        try {
          const res = await linearClient.client.rawRequest(LINEAR_ISSUE_QUERY, {
            dueDate: date,
            email,
          });

          const issues = res.data['issues'].nodes || [];
          if (!issues || issues.length === 0) {
            console.warn(`No issues found for ${email} on ${date}`);
            continue;
          }
          console.log(`Found ${issues.length} issues for ${email} on ${date}`);
          for (const issue of issues) {
            const createdDate = issue.createdAt;
            const dueDate = issue.dueDate;
            const userTimezone = issue.assignee.timezone || 'UTC'; // Default to UTC if no timezone is set
            const isPlanned = this.checkPlanned(createdDate, dueDate, userTimezone);
            const relatedIssues = issue.relations.nodes.map((relation) => relation.issue.identifier);
            const childrenIssues = issue.children.nodes.map((child) => child.identifier);
            const parentIssue = issue.parent ? [issue.parent.identifier] : [];
            const linkedIssues = [...relatedIssues, ...childrenIssues, ...parentIssue];
            let issueStatus = issue.state?.type;
            if (issueStatus === 'completed') {
              if (issue.completedAt && issue.dueDate) {
              // Parse both as DateTime, compare only the date part
              const completedAtDate = DateTime.fromISO(issue.completedAt).toISODate();
              const dueDateDate = DateTime.fromISO(issue.dueDate).toISODate();
              if (completedAtDate <= dueDateDate) {
                issueStatus = 'completed';
              } else {
                issueStatus = 'lateCompleted';
              }
              }
            }

            const issueCode = issue.identifier || '';

            await this.issueEntryModel.findOneAndUpdate(
              {
                issueId: issue.id,
                user: new Types.ObjectId(user._id as string),
              },
              {
                serialNumber: 0,
                issueId: issue.id,
                issueType: 'Task',
                issueStatus: issueStatus,
                issueSummary: issue.title,
                username: issue.assignee.name,
                planned: isPlanned,
                link: '',
                accountId: issue.assignee?.id,
                projectUrl: `https://linear.app/${res.data['organization'].urlKey}`,
                issueIdUrl: issue.url,
                issueCode: issueCode,
                issueLinkUrl: '',
                user: new Types.ObjectId(user._id as string),
                organization: new Types.ObjectId(tool.organization as string),
                date: dueDate,
                linkedIssues: linkedIssues,
                comment: '',
              },
              {
                upsert: true,
                new: true,
              },
            );
          }

          allIssues.push(...issues);
        } catch (error) {
          console.error(`Error type: ${error.type}`);
          console.error(error)

          if (error.type === 'AuthenticationError' || error.message.includes(`It looks like you're trying to use an API key as a Bearer token.`)) {
            //Remove access token from tool
            await this.toolService.removeAccessToken(tool._id);
            console.error(`❌ Authentication error for tool ${tool._id}. Access token removed.`);
          }
          console.error(`❌ Failed to fetch Linear issues for ${email}:`, error.response?.errors || error.message);
        }
      }
    }

    // console.log(`✅ Fetched and saved ${allIssues.length} Linear issues`);
    return { message: `✅ Fetched and saved ${allIssues.length} Linear issues` };
  }

  private checkPlanned(createdAt: string, dueDate: string, userTimezone: string): boolean {
    const createdDay = createdAt.split('T')[0];
    const dueDay = dueDate;
    const createdLocalTime = DateTime.fromISO(createdAt).setZone(userTimezone).toISOTime();
    return createdDay <= dueDay && createdLocalTime < '11:00:00';
  }

  create(createLinearDto: CreateLinearDto) {
    return 'This action adds a new linear';
  }

  findAll() {
    return `This action returns all linear`;
  }

  findOne(id: number) {
    return `This action returns a #${id} linear`;
  }

  update(id: number, updateLinearDto: UpdateLinearDto) {
    return `This action updates a #${id} linear`;
  }

  remove(id: number) {
    return `This action removes a #${id} linear`;
  }
}
