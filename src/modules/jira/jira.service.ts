import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import {
  IJiraUserData,
  IUserResponse,
  IGetUserIssuesResponse,
} from '../../interfaces/jira.interfaces';
import { UserService } from '../users/users.service';

dotenv.config();

@Injectable()
export class JiraService {
  private readonly jiraBaseUrl = process.env.JIRA_BASE_URL;
  private readonly headers = {
    Authorization: `Basic ${Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`,
    ).toString('base64')}`,
    Accept: 'application/json',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getUserDetails(accountId: string): Promise<IJiraUserData> {
    const apiUrl = `${this.jiraBaseUrl}/rest/api/3/user?accountId=${accountId}`;

    try {
      const response = await this.httpService
        .get<IJiraUserData>(apiUrl, { headers: this.headers })
        .toPromise();
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new NotFoundException(`User not found`);
      } else if (error.response && error.response.status === 400) {
        throw new BadRequestException(`Invalid accountId`);
      } else {
        throw new InternalServerErrorException(
          'Error fetching user details from Jira',
        );
      }
    }
  }

  async getUserIssues(accountId: string): Promise<IGetUserIssuesResponse> {
    const apiUrl = `${this.jiraBaseUrl}/rest/api/3/search?jql=assignee=${accountId}`;

    try {
      const response = await this.httpService
        .get(apiUrl, { headers: this.headers })
        .toPromise();

      const issues = response.data.issues;
      if (!issues || issues.length === 0) {
        throw new NotFoundException(`No issues found`);
      }

      return {
        message: 'Issues fetched successfully',
        statusCode: 200,
        issues,
      };
    } catch (error) {
      if (error.response && error.response.status === 400) {
        throw new BadRequestException(`Invalid query or user ID`);
      } else if (error.response && error.response.status === 404) {
        throw new NotFoundException(`No issues found for user`);
      } else {
        throw new InternalServerErrorException(
          'Error fetching issues from Jira',
        );
      }
    }
  }

  async fetchAndSaveUser(accountId: string): Promise<IUserResponse> {
    try {
      const userDetails = await this.getUserDetails(accountId);
      const saveResponse = await this.userService.saveUser(
        accountId,
        userDetails,
      );
      if (saveResponse.statusCode === 409) {
        throw new ConflictException(saveResponse.message);
      }

      return saveResponse;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException('Error fetching and saving user');
    }
  }

  async countNotDoneIssues(accountId: string) {
    const notDoneApiUrl = `${this.jiraBaseUrl}/rest/api/3/search?jql=assignee=${accountId} AND status!=Done`;
  
    try {
      const response = await this.httpService
        .get(notDoneApiUrl, { headers: this.headers })
        .toPromise();
      const notDoneIssues = response.data.issues;
  
      const countsByDate = {};
      notDoneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0]; // Use duedate instead of created
        const issueType = issue.fields.issuetype.name;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = {
              Task: 0,
              Bug: 0,
              Story: 0,
            };
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
        }
      });
  
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveNotDoneIssueCounts(accountId, date, counts);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching not-done issues from Jira',
      );
    }
  }
  
  async countDoneIssues(accountId: string) {
    const doneApiUrl = `${this.jiraBaseUrl}/rest/api/3/search?jql=assignee=${accountId} AND status=Done`;
  
    try {
      const response = await this.httpService
        .get(doneApiUrl, { headers: this.headers })
        .toPromise();
      const doneIssues = response.data.issues;
      const countsByDate = {};
      doneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0]; // Use duedate instead of created
        const issueType = issue.fields.issuetype.name;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = {
              Task: 0,
              Bug: 0,
              Story: 0,
            };
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
        }
      });
  
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveDoneIssueCounts(accountId, date, counts);
      }
    } catch (error) {
      throw new InternalServerErrorException('Error fetching done issues from Jira');
    }
  }
  

  async saveNotDoneIssueCounts(accountId: string, date: string, counts: any) {
    try {
      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      const existingHistory = user.issueHistory.find(
        (history) => history.date === date,
      );

      if (existingHistory) {
        existingHistory.issuesCount.notDone = counts;
      } else {
        user.issueHistory.push({
          date,
          issuesCount: {
            notDone: counts,
          },
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error saving not-done issue counts',
      );
    }
  }

  async saveDoneIssueCounts(accountId: string, date: string, counts: any) {
    try {
      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      const existingHistory = user.issueHistory.find(
        (history) => history.date === date,
      );

      if (existingHistory) {
        existingHistory.issuesCount.done = counts;
      } else {
        user.issueHistory.push({
          date,
          issuesCount: {
            done: counts,
          },
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException('Error saving done issue counts');
    }
  }

  // @Cron('42 08 * * *')
  async updateMorningIssueHistory() {
    console.log('Running updateMorningIssueHistory');
    try {
      const users = await this.userModel.find().exec();
      for (const user of users) {
        await this.countNotDoneIssues(user.accountId);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error updating issue history for all users in the morning',
      );
    }
  }

  // @Cron('53 08 * * *')
  async updateEveningIssueHistory() {
    console.log('Running updateEveningIssueHistory');
    try {
      const users = await this.userModel.find().exec();
      for (const user of users) {
        await this.countDoneIssues(user.accountId);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error updating issue history for all users in the evening',
      );
    }
  }

}
