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
import { Designation, Issue, User } from '../users/schemas/user.schema';
import {
  IJiraUserData,
  IUserResponse,
  IGetUserIssuesResponse,
} from '../../interfaces/jira.interfaces';
import { UserService } from '../users/users.service';
import { Cron } from '@nestjs/schedule';

dotenv.config();

@Injectable()
export class JiraService {
  // private readonly jiraBaseUrl = process.env.JIRA_BASE_URL;
  private readonly jiraBaseUrl = process.env.JIRA_BASE_URL1; // First URL
  private readonly jiraBaseUrl2 = process.env.JIRA_BASE_URL2; // Second URL
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

  private async fetchFromBothUrls(endpoint: string) {
    const url1 = `${this.jiraBaseUrl}${endpoint}`;
    const url2 = `${this.jiraBaseUrl2}${endpoint}`;

    try {
      // Perform both API calls in parallel
      const [response1, response2] = await Promise.all([
        this.httpService.get(url1, { headers: this.headers }).toPromise(),
        this.httpService.get(url2, { headers: this.headers }).toPromise(),
      ]);

      // Combine or process both responses
      return {
        fromUrl1: response1.data,
        fromUrl2: response2.data,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error fetching data from Jira');
    }
  }

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


  async getUserIssues(accountId: string): Promise<IGetUserIssuesResponse[]> {
    const endpoint = `/rest/api/3/search?jql=assignee=${accountId}`;

    try {
      const data = await this.fetchFromBothUrls(endpoint);

      const transformIssues = (issues) =>
        issues.map((issue) => ({
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          issueType: issue.fields.issuetype.name,
          dueDate: issue.fields.duedate,
        }));

      return [
        {
          message: 'Issues retrieved successfully from URL 1',
          statusCode: 200,
          issues: transformIssues(data.fromUrl1.issues),
        },
        {
          message: 'Issues retrieved successfully from URL 2',
          statusCode: 200,
          issues: transformIssues(data.fromUrl2.issues),
        },
      ];
    } catch (error) {
      throw new InternalServerErrorException('Error fetching issues from Jira');
    }
  }

  async fetchAndSaveUser(
    accountId: string,
    designation: Designation,
  ): Promise<IUserResponse> {
    try {
      // Fetch user details
      const userDetails = await this.getUserDetails(accountId);

      // Save user
      const saveResponse = await this.userService.saveUser(
        accountId,
        userDetails,
        designation,
      );

      // Handle specific status codes
      if (saveResponse.statusCode === 409) {
        throw new ConflictException(saveResponse.message);
      }

      if (saveResponse.statusCode === 400) {
        throw new BadRequestException(saveResponse.message);
      }

      return saveResponse;
    } catch (error) {
      // Handle known exceptions
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      }

      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Error fetching and saving user');
    }
  }

  async countNotDoneIssues(accountId: string): Promise<void> {
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
    const formattedStartDate = date30DaysAgo.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });

    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
  
    const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate>=${formattedStartDate} AND duedate<=${today}`;
  
  
    try {
      // Fetch issues from both Jira URLs in parallel
      const [response1, response2] = await Promise.all([
        this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers }).toPromise(),
        this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers }).toPromise(),
      ]);
  
      // Combine issues from both responses
      const notDoneIssues = [...response1.data.issues, ...response2.data.issues];
  
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: Issue[] } = {};
  
      notDoneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0];
        const issueType = issue.fields.issuetype.name;
        const issueId = issue.id;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;
        const dueDateFormatted = issue.fields.duedate || null;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
            issuesByDate[dueDate] = [];
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
  
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate: dueDateFormatted,
          });
        }
      });
  
      // Save the results by date
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveNotDoneIssueCounts(
          accountId,
          date,
          counts,
          issuesByDate[date],
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching not-done issues from Jira',
      );
    }
  }
  
  async countDoneIssues(accountId: string): Promise<void> {
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
    const formattedStartDate = date30DaysAgo.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
  
    // Format today's date for the end of the range
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
  
    // Endpoint with the date range for done issues
    const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status=Done AND duedate>=${formattedStartDate} AND duedate<=${today}`;
  
    try {
      // Fetch done issues from both Jira URLs in parallel
      const [response1, response2] = await Promise.all([
        this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers }).toPromise(),
        this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers }).toPromise(),
      ]);
  
      // Combine done issues from both responses
      const doneIssues = [...response1.data.issues, ...response2.data.issues];
  
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: Issue[] } = {};
  
      doneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0];
        const issueType = issue.fields.issuetype.name;
        const issueId = issue.id;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;
        const dueDateFormatted = issue.fields.duedate || null;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
            issuesByDate[dueDate] = [];
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
  
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate: dueDateFormatted,
          });
        }
      });
  
      // Save the results by date
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveDoneIssueCounts(
          accountId,
          date,
          counts,
          issuesByDate[date],
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching done issues from Jira',
      );
    }
  }
  

  async saveNotDoneIssueCounts(
    accountId: string,
    date: string,
    counts: { Task: number; Bug: number; Story: number },
    issues: Issue[],
  ): Promise<void> {
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
        existingHistory.notDoneIssues = issues;
      } else {
        user.issueHistory.push({
          date,
          issuesCount: { notDone: counts },
          notDoneIssues: issues,
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error saving not-done issue counts',
      );
    }
  }

  async saveDoneIssueCounts(
    accountId: string,
    date: string,
    counts: { Task: number; Bug: number; Story: number },
    issues: Issue[],
  ): Promise<void> {
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
        existingHistory.doneIssues = issues;
      } else {
        user.issueHistory.push({
          date,
          issuesCount: { done: counts },
          doneIssues: issues,
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException('Error saving done issue counts');
    }
  }

  async countNotDoneIssuesForToday(accountId: string): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
    console.log(today);
  
    const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate=${today}`;
  
    try {
      // Fetch issues from both Jira URLs in parallel
      const [response1, response2] = await Promise.all([
        this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers }).toPromise(),
        this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers }).toPromise(),
      ]);
  
      // Combine issues from both responses
      const notDoneIssues = [...response1.data.issues, ...response2.data.issues];
  
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: Issue[] } = {};
  
      notDoneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0];
        const issueType = issue.fields.issuetype.name;
        const issueId = issue.id;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
            issuesByDate[dueDate] = [];
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
  
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
          });
        }
      });
  
      // Save the results by date
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveNotDoneIssueCounts(
          accountId,
          date,
          counts,
          issuesByDate[date],
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching not-done issues from Jira for today',
      );
    }
  }
  
  async countDoneIssuesForToday(accountId: string): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
  
    const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status=Done AND duedate=${today}`;
  
    try {
      // Fetch done issues from both Jira URLs in parallel
      const [response1, response2] = await Promise.all([
        this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers }).toPromise(),
        this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers }).toPromise(),
      ]);
  
      // Combine issues from both responses
      const doneIssues = [...response1.data.issues, ...response2.data.issues];
  
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: Issue[] } = {};
  
      doneIssues.forEach((issue) => {
        const dueDate = issue.fields.duedate?.split('T')[0];
        const issueType = issue.fields.issuetype.name;
        const issueId = issue.id;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;
  
        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
            issuesByDate[dueDate] = [];
          }
  
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }
  
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
          });
        }
      });
  
      // Save the results by date
      for (const [date, counts] of Object.entries(countsByDate)) {
        await this.saveDoneIssueCounts(
          accountId,
          date,
          counts,
          issuesByDate[date],
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching done issues from Jira for today',
      );
    }
  }
  

  // @Cron('53 23 * * *')
  // async updateMorningIssueHistory(): Promise<void> {
  //   console.log('Running updateMorningIssueHistory');
  //   try {
  //     const users = await this.userModel.find().exec();
  //     for (const user of users) {
  //       await this.countNotDoneIssues(user.accountId);
  //     }
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       'Error updating issue history for all users in the morning',
  //     );
  //   }
  // }

  @Cron('46 23 * * *')
  async updateMorningIssueHistory(): Promise<void> {
    console.log('Running updateMorningIssueHistory');
    try {
      const users = await this.userModel.find().exec();
      for (const user of users) {
        await this.countNotDoneIssuesForToday(user.accountId);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error updating issue history for all users in the morning',
      );
    }
  }

  // @Cron('28 15 * * *')
  // async updateEveningIssueHistory(): Promise<void> {
  //   console.log('Running updateEveningIssueHistory');
  //   try {
  //     const users = await this.userModel.find().exec();
  //     for (const user of users) {
  //       await this.countDoneIssues(user.accountId);
  //     }
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       'Error updating issue history for all users in the evening',
  //     );
  //   }
  // }

  @Cron('32 00 * * *')
  async updateEveningIssueHistory(): Promise<void> {
    console.log('Running updateEveningIssueHistory');
    try {
      const users = await this.userModel.find().exec();
      for (const user of users) {
        await this.countDoneIssuesForToday(user.accountId);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error updating issue history for all users in the evening',
      );
    }
  }

  @Cron('33 00 * * *')
  async getAllUserMetrics() {
    console.log('Running metrics');
    try {
      // Fetch all users
      const users = await this.userModel.find({}).exec();

      // Process each user to calculate metrics
      const updatedUsers = await Promise.all(
        users.map(async (user) => {
          const issueHistory = user.issueHistory;

          // Aggregate counts by date and calculate metrics
          const metricsByDay = await Promise.all(
            issueHistory.map(async (entry) => {
              const { date, issuesCount } = entry;
              const counts = issuesCount;

              let taskCompletionRate = 0;
              let userStoryCompletionRate = 0;
              let overallScore = 0;
              let comment = ''; 

              const totalNotDoneTasksAndBugs =
                counts.notDone.Task + counts.notDone.Bug;
              const totalDoneTasksAndBugs = counts.done.Task + counts.done.Bug;

              // Calculate task completion rate only if there are tasks or bugs
              if (totalNotDoneTasksAndBugs > 0) {
                taskCompletionRate =
                  (totalDoneTasksAndBugs / totalNotDoneTasksAndBugs) * 100;
              }

              // Calculate user story completion rate only if there are user stories
              if (counts.notDone.Story > 0) {
                userStoryCompletionRate =
                  (counts.done.Story / counts.notDone.Story) * 100;
              }

              if (totalDoneTasksAndBugs+counts.done.Story > totalNotDoneTasksAndBugs+counts.notDone.Story) {
                taskCompletionRate = 100;
                userStoryCompletionRate = 100;
                comment = `Your target was ${totalDoneTasksAndBugs+counts.notDone.Story}, but you completed ${totalNotDoneTasksAndBugs+counts.done.Story}. This is not a good sign.`;
              }

              // Calculate overall score based on available metrics
              const nonZeroCompletionRates = [];
              if (totalNotDoneTasksAndBugs > 0) {
                nonZeroCompletionRates.push(taskCompletionRate);
              }
              if (counts.notDone.Story > 0) {
                nonZeroCompletionRates.push(userStoryCompletionRate);
              }

              // If there are non-zero completion rates, calculate the average
              if (nonZeroCompletionRates.length > 0) {
                overallScore =
                  nonZeroCompletionRates.reduce((sum, rate) => sum + rate, 0) /
                  nonZeroCompletionRates.length;
              }

              // Ensure rates are valid numbers
              const taskCompletionRateNum = isNaN(taskCompletionRate)
                ? 0
                : taskCompletionRate;
              const userStoryCompletionRateNum = isNaN(userStoryCompletionRate)
                ? 0
                : userStoryCompletionRate;
              const overallScoreNum = isNaN(overallScore) ? 0 : overallScore;

              // Update entry with the calculated metrics
              entry.taskCompletionRate = taskCompletionRateNum;
              entry.userStoryCompletionRate = userStoryCompletionRateNum;
              entry.overallScore = overallScoreNum;
              entry.comment = comment;

              return {
                date,
                numberOfTasks: counts.notDone.Task,
                numberOfBugs: counts.notDone.Bug,
                numberOfUserStories: counts.notDone.Story,
                completedTasks: totalDoneTasksAndBugs,
                completedUserStories: counts.done.Story,
                taskCompletionRate: taskCompletionRateNum,
                userStoryCompletionRate: userStoryCompletionRateNum,
                overallScore: overallScoreNum,
                comment,
              };
            }),
          );

          // Calculate current performance by averaging overall scores
          const totalScore = metricsByDay.reduce(
            (sum, day) => sum + day.overallScore,
            0,
          );
          const currentPerformance = metricsByDay.length
            ? totalScore / metricsByDay.length
            : 0;

          user.currentPerformance = currentPerformance;
          user.issueHistory = issueHistory;
          await user.save();

          return user;
        }),
      );

      return {
        message: 'User metrics calculated successfully',
        users: updatedUsers,
      };
    } catch (error) {
      throw new error();
    }
  }
}
