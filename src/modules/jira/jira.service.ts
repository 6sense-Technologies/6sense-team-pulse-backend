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
import {
  Designation,
  Issue,
  Project,
  User,
} from '../users/schemas/user.schema';
import {
  IGetUserIssuesResponse,
  IJiraUserData,
  IUserResponse,
} from '../../interfaces/jira.interfaces';
import { UserService } from '../users/users.service';
import { Cron } from '@nestjs/schedule';
import { IssueHistory } from '../users/schemas/IssueHistory.schems';

dotenv.config();

@Injectable()
export class JiraService {
  private readonly jiraBaseUrl = process.env.JIRA_BASE_URL1;
  private readonly jiraBaseUrl2 = process.env.JIRA_BASE_URL2;
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
    @InjectModel(IssueHistory.name)
    private readonly issueHistoryModel: Model<IssueHistory>,
  ) {}

  private async fetchFromBothUrls(endpoint: string) {
    const url1 = `${this.jiraBaseUrl}${endpoint}`;
    const url2 = `${this.jiraBaseUrl2}${endpoint}`;

    try {
      const [response1, response2] = await Promise.all([
        this.httpService.get(url1, { headers: this.headers }).toPromise(),
        this.httpService.get(url2, { headers: this.headers }).toPromise(),
      ]);

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
      const response1 = await this.httpService
        .get(`${this.jiraBaseUrl}${endpoint}`, {
          headers: this.headers,
        })
        .toPromise();

      return response1.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        try {
          const response2 = await this.httpService
            .get(`${this.jiraBaseUrl2}${endpoint}`, {
              headers: this.headers,
            })
            .toPromise();

          return response2.data;
        } catch (error2) {
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
          created: issue.fields.created,
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

  async saveUser(
    accountId: string,
    userData: IJiraUserData,
    designation: Designation,
    project: Project,
  ): Promise<{ statusCode: number; message: string; user?: User }> {
    try {
      if (!Object.values(Designation).includes(designation)) {
        throw new BadRequestException({
          status: 400,
          errorCode: 'invalid_designation',
          message: `Invalid designation: ${designation}`,
          data: {},
        });
      }

      if (!Object.values(Project).includes(project)) {
        throw new BadRequestException({
          status: 400,
          errorCode: 'invalid_project',
          message: `Invalid project: ${project}`,
          data: {},
        });
      }

      const avatar48x48 = userData.avatarUrls['48x48'];

      const userToSave = {
        accountId: userData.accountId,
        displayName: userData.displayName,
        emailAddress: userData.emailAddress,
        avatarUrls: avatar48x48,
        currentPerformance: userData.currentPerformance || 0,
        designation,
        project,
      };

      const existingUser = await this.userModel.findOne({ accountId });
      if (existingUser) {
        return {
          message: 'User already exists',
          statusCode: 409,
        };
      } else {
        const newUser = new this.userModel(userToSave);
        await newUser.save();
        return {
          message: 'User saved successfully',
          statusCode: 201,
          user: newUser,
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async fetchAndSaveUser(
    accountId: string,
    designation: Designation,
    project: Project,
  ): Promise<IUserResponse> {
    try {
      const userDetails = await this.getUserDetails(accountId);
      const saveResponse = await this.saveUser(
        accountId,
        userDetails,
        designation,
        project,
      );

      if (saveResponse.statusCode === 409) {
        throw new ConflictException(saveResponse.message);
      }

      if (saveResponse.statusCode === 400) {
        throw new BadRequestException(saveResponse.message);
      }
      return saveResponse;
    } catch (error) {
      throw error;
    }
  }

  async countNotDoneIssuesForToday(accountId: string): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });
    console.log(today);

    const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate=${today}`;

    try {
      const [response1, response2] = await Promise.all([
        this.httpService
          .get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers })
          .toPromise(),
        this.httpService
          .get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers })
          .toPromise(),
      ]);

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

          // Extract issue links
          const issueLinks = issue.fields.issuelinks || [];
          const linkedIssues = issueLinks
            .map((link) => {
              const linkedIssue = link.outwardIssue || link.inwardIssue;
              return linkedIssue
                ? {
                    issueId: linkedIssue.id,
                    issueType: linkedIssue.fields.issuetype.name,
                    summary: linkedIssue.fields.summary,
                    status: linkedIssue.fields.status.name,
                    dueDate: linkedIssue.fields.duedate?.split('T')[0] || null,
                  }
                : null;
            })
            .filter(Boolean); // Filter out any null values

          // Save the main issue along with linked issues
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
            issueLinks: linkedIssues, // Include linked issues here
          });
        }
      });

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
      const [response1, response2] = await Promise.all([
        this.httpService
          .get(`${this.jiraBaseUrl}${endpoint}`, { headers: this.headers })
          .toPromise(),
        this.httpService
          .get(`${this.jiraBaseUrl2}${endpoint}`, { headers: this.headers })
          .toPromise(),
      ]);

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

          // Count the issue types
          if (issueType === 'Task') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug') {
            countsByDate[dueDate].Bug++;
          } else if (issueType === 'Story') {
            countsByDate[dueDate].Story++;
          }

          const issueLinks = issue.fields.issuelinks || [];
          const linkedIssues = issueLinks
            .map((link) => {
              const linkedIssue = link.outwardIssue || link.inwardIssue;
              return linkedIssue
                ? {
                    issueId: linkedIssue.id,
                    issueType: linkedIssue.fields.issuetype.name,
                    summary: linkedIssue.fields.summary,
                    status: linkedIssue.fields.status.name,
                    dueDate: linkedIssue.fields.duedate?.split('T')[0] || null,
                  }
                : null;
            })
            .filter(Boolean); // Filter out any null values

          // Count linked bugs
          const linkedBugsCount = linkedIssues.filter(
            (linkedIssue) => linkedIssue.issueType === 'Bug',
          ).length;

          countsByDate[dueDate].LinkedBugs += linkedBugsCount;

          // Save the main issue along with linked issues
          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
            issueLinks: linkedIssues, // Include linked issues here
          });
        }
      }

      // Save the counts and issue data
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

        // Save counts and issues for the date
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

      // Check for existing history entry in IssueHistory table
      let issueHistoryEntry = await this.issueHistoryModel.findOne({
        userId: user._id,
        date,
      });

      if (issueHistoryEntry) {
        // Update existing entry
        issueHistoryEntry.issuesCount.notDone = counts;
        issueHistoryEntry.notDoneIssues = issues;
      } else {
        // Create new entry
        issueHistoryEntry = new this.issueHistoryModel({
          userId: user._id,
          date,
          issuesCount: { notDone: counts },
          notDoneIssues: issues,
        });
      }

      await issueHistoryEntry.save();

      // Update user's issue history
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

      // Check for existing history entry in IssueHistory table
      let issueHistoryEntry = await this.issueHistoryModel.findOne({
        userId: user._id,
        date,
      });

      if (issueHistoryEntry) {
        // Update existing entry
        issueHistoryEntry.issuesCount.done = counts;
        issueHistoryEntry.doneIssues = issues;
        issueHistoryEntry.codeToBugRatio = codeToBugRatio;
      } else {
        // Create new entry
        issueHistoryEntry = new this.issueHistoryModel({
          userId: user._id,
          date,
          issuesCount: { done: counts },
          doneIssues: issues,
          codeToBugRatio,
        });
      }

      await issueHistoryEntry.save();

      // Update user's issue history
      const existingHistory = user.issueHistory.find(
        (history) => history.date === date,
      );

      if (existingHistory) {
        existingHistory.issuesCount.done = counts;
        existingHistory.doneIssues = issues;
        existingHistory.codeToBugRatio = codeToBugRatio;
      } else {
        user.issueHistory.push({
          date,
          issuesCount: { done: counts },
          doneIssues: issues,
          codeToBugRatio,
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException('Error saving done issue counts');
    }
  }

  // async saveNotDoneIssueCounts(
  //   accountId: string,
  //   date: string,
  //   counts: { Task: number; Bug: number; Story: number },
  //   issues: Issue[],
  // ): Promise<void> {
  //   try {
  //     const user = await this.userModel.findOne({ accountId });

  //     if (!user) {
  //       throw new InternalServerErrorException('User not found');
  //     }

  //     const existingHistory = user.issueHistory.find(
  //       (history) => history.date === date,
  //     );

  //     if (existingHistory) {
  //       existingHistory.issuesCount.notDone = counts;
  //       existingHistory.notDoneIssues = issues;
  //     } else {
  //       user.issueHistory.push({
  //         date,
  //         issuesCount: { notDone: counts },
  //         notDoneIssues: issues,
  //       });
  //     }

  //     await user.save();
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       'Error saving not-done issue counts',
  //     );
  //   }
  // }

  // async saveDoneIssueCounts(
  //   accountId: string,
  //   date: string,
  //   counts: { Task: number; Bug: number; Story: number },
  //   issues: Issue[],
  //   codeToBugRatio: number,
  // ): Promise<void> {
  //   try {
  //     const user = await this.userModel.findOne({ accountId });

  //     if (!user) {
  //       throw new InternalServerErrorException('User not found');
  //     }

  //     const existingHistory = user.issueHistory.find(
  //       (history) => history.date === date,
  //     );

  //     if (existingHistory) {
  //       existingHistory.issuesCount.done = counts;
  //       existingHistory.doneIssues = issues;
  //       existingHistory.codeToBugRatio = codeToBugRatio;
  //     } else {
  //       user.issueHistory.push({
  //         date,
  //         issuesCount: { done: counts },
  //         doneIssues: issues,
  //         codeToBugRatio,
  //       });
  //     }

  //     await user.save();
  //   } catch (error) {
  //     throw new InternalServerErrorException('Error saving done issue counts');
  //   }
  // }

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
      const users = await this.userModel.find({}).exec();
      const updatedUsers = await Promise.all(
        users.map(async (user) => {
          const issueHistory = user.issueHistory;
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
              if (totalNotDoneTasksAndBugs > 0) {
                taskCompletionRate =
                  (totalDoneTasksAndBugs / totalNotDoneTasksAndBugs) * 100;
              }
              if (counts.notDone.Story > 0) {
                userStoryCompletionRate =
                  (counts.done.Story / counts.notDone.Story) * 100;
              }
              if (
                totalDoneTasksAndBugs + counts.done.Story >
                totalNotDoneTasksAndBugs + counts.notDone.Story
              ) {
                taskCompletionRate = 100;
                userStoryCompletionRate = 100;
                comment = `Your target was ${totalNotDoneTasksAndBugs + counts.notDone.Story}, but you completed ${totalDoneTasksAndBugs + counts.done.Story}.`;
              }
              const notDoneIssueIds = notDoneIssues.map(
                (issue) => issue.issueId,
              );
              const doneIssueIds = doneIssues.map((issue) => issue.issueId);
              const unmatchedDoneIssueIds = doneIssueIds.filter(
                (doneId) => !notDoneIssueIds.includes(doneId),
              );
              if (unmatchedDoneIssueIds.length > 0) {
                comment += ` ${unmatchedDoneIssueIds.length} issues that you completed do not match with your targeted issues.`;
              }
              const nonZeroCompletionRates = [];
              if (totalNotDoneTasksAndBugs > 0) {
                nonZeroCompletionRates.push(taskCompletionRate);
              }
              if (counts.notDone.Story > 0) {
                nonZeroCompletionRates.push(userStoryCompletionRate);
              }

              if (nonZeroCompletionRates.length > 0) {
                overallScore =
                  nonZeroCompletionRates.reduce((sum, rate) => sum + rate, 0) /
                  nonZeroCompletionRates.length;
              }

              const taskCompletionRateNum = isNaN(taskCompletionRate)
                ? 0
                : taskCompletionRate;
              const userStoryCompletionRateNum = isNaN(userStoryCompletionRate)
                ? 0
                : userStoryCompletionRate;
              const overallScoreNum = isNaN(overallScore) ? 0 : overallScore;

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
