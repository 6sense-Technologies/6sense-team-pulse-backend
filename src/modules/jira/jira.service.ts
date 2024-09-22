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
} from '../../interfaces/jira.interfaces';
import { UserService } from '../users/users.service';
import { Cron } from '@nestjs/schedule';

dotenv.config();

@Injectable()
export class JiraService {
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
    const endpoint = `/rest/api/3/user?accountId=${accountId}`;

    try {
      // Attempt to fetch user details from the primary Jira base URL
      const response1 = await this.httpService
        .get(`${this.jiraBaseUrl}${endpoint}`, {
          headers: this.headers,
        })
        .toPromise();

      // Return user details if found
      return response1.data;
    } catch (error) {
      // Handle 404 error to try the secondary base URL
      if (error.response && error.response.status === 404) {
        try {
          const response2 = await this.httpService
            .get(`${this.jiraBaseUrl2}${endpoint}`, {
              headers: this.headers,
            })
            .toPromise();

          // Return user details if found
          return response2.data;
        } catch (error2) {
          // Handle errors from the second URL
          if (error2.response) {
            if (error2.response.status === 400) {
              throw new BadRequestException(`Invalid accountId`);
            } else if (error2.response.status === 404) {
              throw new NotFoundException(`User not found on both URLs`);
            }
          }
          throw new InternalServerErrorException(
            'Error fetching user details from the second Jira URL',
          );
        }
      } else if (error.response && error.response.status === 400) {
        throw new BadRequestException(`Invalid accountId`);
      } else {
        throw new InternalServerErrorException(
          'Error fetching user details from the first Jira URL',
        );
      }
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
    codeToBugRatio: number,
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
        // Update existing history
        existingHistory.issuesCount.done = counts;
        existingHistory.doneIssues = issues;
        existingHistory.codeToBugRatio = codeToBugRatio; // Save the code-to-bug ratio
      } else {
        // Add a new history entry if none exists for the date
        user.issueHistory.push({
          date,
          issuesCount: { done: counts },
          doneIssues: issues,
          codeToBugRatio, // Save the code-to-bug ratio
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
        this.httpService
          .get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers })
          .toPromise(),
        this.httpService
          .get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers })
          .toPromise(),
      ]);

      // Combine issues from both responses
      const notDoneIssues = [
        ...response1.data.issues,
        ...response2.data.issues,
      ];

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
        this.httpService
          .get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers })
          .toPromise(),
        this.httpService
          .get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers })
          .toPromise(),
      ]);

      // Combine issues from both responses
      const doneIssues = [...response1.data.issues, ...response2.data.issues];

      const countsByDate: {
        [key: string]: {
          Task: number;
          Bug: number;
          Story: number;
          LinkedBugs: number;
        };
      } = {};
      const issuesByDate: { [key: string]: Issue[] } = {};

      for (const issue of doneIssues) {
        const dueDate = issue.fields.duedate?.split('T')[0];
        const issueType = issue.fields.issuetype.name;
        const issueId = issue.id;
        const summary = issue.fields.summary;
        const status = issue.fields.status.name;

        if (dueDate) {
          if (!countsByDate[dueDate]) {
            countsByDate[dueDate] = {
              Task: 0,
              Bug: 0,
              Story: 0,
              LinkedBugs: 0,
            };
            issuesByDate[dueDate] = [];
          }

          // Count Tasks, Bugs, and Stories
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }

          // Check for linked bugs in issue links
          const issueLinks = issue.fields.issuelinks || [];
          const linkedBugs = issueLinks.filter(
            (link) =>
              link.outwardIssue?.fields.issuetype.name === 'Bug' ||
              link.inwardIssue?.fields.issuetype.name === 'Bug',
          ).length;

          countsByDate[dueDate].LinkedBugs += linkedBugs;

          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
          });
        }
      }

      // Save the results by date and calculate the bug-to-task/story ratio
      for (const [date, counts] of Object.entries(countsByDate)) {
        const tasksWithLinkedBugs = doneIssues.filter(
          (issue) =>
            (issue.fields.issuetype.name === 'Task' ||
              issue.fields.issuetype.name === 'Story') &&
            issue.fields.issuelinks.some(
              (link) =>
                link.outwardIssue?.fields.issuetype.name === 'Bug' ||
                link.inwardIssue?.fields.issuetype.name === 'Bug',
            ),
        );

        const taskAndStoryCount = tasksWithLinkedBugs.length;
        const linkedBugsCount = counts.LinkedBugs;

        let codeToBugRatio = 0;
        if (taskAndStoryCount > 0) {
          codeToBugRatio = parseFloat(
            (linkedBugsCount / taskAndStoryCount).toFixed(2),
          );
        }

        await this.saveDoneIssueCounts(
          accountId,
          date,
          counts,
          issuesByDate[date],
          codeToBugRatio,
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching done issues from Jira for today',
      );
    }
  }

  @Cron('33 17 * * *')
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
              const { date, issuesCount, notDoneIssues, doneIssues } = entry;
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

              // Check if the number of done tasks is greater than not-done
              if (
                totalDoneTasksAndBugs + counts.done.Story >
                totalNotDoneTasksAndBugs + counts.notDone.Story
              ) {
                taskCompletionRate = 100;
                userStoryCompletionRate = 100;
                comment = `Your target was ${totalNotDoneTasksAndBugs + counts.notDone.Story}, but you completed ${totalDoneTasksAndBugs + counts.done.Story}.`;
              }

              // Check if task IDs in notDoneIssues match with those in doneIssues
              const notDoneIssueIds = notDoneIssues.map(
                (issue) => issue.issueId,
              );
              const doneIssueIds = doneIssues.map((issue) => issue.issueId);

              // Find tasks in `doneIssues` that do not match any in `notDoneIssues`
              const unmatchedDoneIssueIds = doneIssueIds.filter(
                (doneId) => !notDoneIssueIds.includes(doneId),
              );

              // Check if there are unmatched done tasks
              if (unmatchedDoneIssueIds.length > 0) {
                comment += ` ${unmatchedDoneIssueIds.length} task(s) that you completed do not match with your targeted task(s).`;
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
      throw error;
    }
  }
}
