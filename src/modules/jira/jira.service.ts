import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IIssue, User } from '../users/schemas/user.schema';
import {
  IDailyMetrics,
  IJiraIssue,
  IJiraUserData,
  IJirsUserIssues,
  ISuccessResponse,
} from '../../common/interfaces/jira.interfaces';
import { TrelloService } from '../trello/trello.service';
import { UserService } from '../users/users.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { handleError } from 'src/common/helpers/error.helper';
import { Designation, Project } from '../users/enums/user.enum';
import {
  validateAccountId,
  validateDate,
} from 'src/common/helpers/validation.helper';

dotenv.config();

@Injectable()
export class JiraService {
  private readonly jiraBaseUrl1 = process.env.JIRA_BASE_URL1;
  private readonly jiraBaseUrl2 = process.env.JIRA_BASE_URL2;
  private readonly jiraBaseUrl3 = process.env.JIRA_BASE_URL3;
  private readonly headers = {
    Authorization: `Basic ${Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`,
    ).toString('base64')}`,
    Accept: 'application/json',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly trelloService: TrelloService,
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    // Constructor for injecting userModel
  }

  private async fetchFromAllUrls(endpoint: string): Promise<any> {
    try {
      const url1 = `${this.jiraBaseUrl1}${endpoint}`;
      const url2 = `${this.jiraBaseUrl2}${endpoint}`;
      const url3 = `${this.jiraBaseUrl3}${endpoint}`;

      const [response1, response2, response3] = await Promise.all([
        firstValueFrom(this.httpService.get(url1, { headers: this.headers })),
        firstValueFrom(this.httpService.get(url2, { headers: this.headers })),
        firstValueFrom(this.httpService.get(url3, { headers: this.headers })),
      ]);

      return {
        fromUrl1: response1.data,
        fromUrl2: response2.data,
        fromUrl3: response3.data,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async getUserDetails(accountId: string): Promise<IJiraUserData> {
    validateAccountId(accountId);
    const endpoint = `/rest/api/3/user?accountId=${accountId}`;
    try {
      const response1 = await firstValueFrom(
        this.httpService.get(`${this.jiraBaseUrl1}${endpoint}`, {
          headers: this.headers,
        }),
      );
      return response1.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        try {
          const response2 = await firstValueFrom(
            this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
              headers: this.headers,
            }),
          );
          return response2.data;
        } catch (error2) {
          if (error2.response && error2.response.status === 404) {
            try {
              const response3 = await firstValueFrom(
                this.httpService.get(`${this.jiraBaseUrl3}${endpoint}`, {
                  headers: this.headers,
                }),
              );
              return response3.data;
            } catch (error3) {
              handleError(error3);
            }
          } else {
            handleError(error2);
          }
        }
      } else {
        handleError(error);
      }
    }
  }

  async getUserIssues(
    accountId: string,
    date: string,
  ): Promise<IJirsUserIssues[]> {
    try {
      validateAccountId(accountId);
      validateDate(date);
      const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND duedate=${date}`;
      const data = await this.fetchFromAllUrls(endpoint);

      const transformIssues = (issues): IJiraIssue[] => {
        return issues.map((issue) => {
          return {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            issueType: issue.fields.issuetype.name,
            dueDate: issue.fields.duedate,
            created: issue.fields.created,
            storypoints: issue.fields.customfield_10016,
          };
        });
      };

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
      handleError(error);
    }
  }

  async fetchAndSaveUser(
    accountId: string,
    userFrom: string,
    designation: Designation,
    project: Project,
  ): Promise<ISuccessResponse> {
    try {
      if (!Object.values(Designation).includes(designation)) {
        throw new BadRequestException('Invalid designation');
      }

      if (!Object.values(Project).includes(project)) {
        throw new BadRequestException('Invalid project');
      }

      const userDetails = await this.getUserDetails(accountId);

      const userToSave = {
        accountId: userDetails.accountId,
        displayName: userDetails.displayName,
        emailAddress: userDetails.emailAddress,
        avatarUrls: userDetails.avatarUrls['48x48'],
        designation,
        project,
        userFrom,
      };
      const existingUser = await this.userModel.findOne({ accountId });
      if (existingUser) {
        throw new ConflictException('User already exists');
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
      handleError(error);
    }
  }

  async fetchAndUpdateUser(accountId: string): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      const userDetails = await this.getUserDetails(accountId);

      if (!userDetails) {
        throw new BadRequestException('User not found in Jira');
      }

      const existingUser = await this.userModel.findOne({ accountId });
      if (!existingUser) {
        throw new NotFoundException('User does not exist in the database');
      }

      existingUser.displayName = userDetails.displayName;
      existingUser.emailAddress = userDetails.emailAddress;
      existingUser.avatarUrls = userDetails.avatarUrls['48x48'];

      await existingUser.save();

      return {
        message: 'User updated successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async countPlannedIssues(accountId: string, date: string): Promise<void> {
    try {
      validateAccountId(accountId);
      validateDate(date);
      const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate=${date}`;
      const responses = await Promise.all([
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl1}${endpoint}`, {
            headers: this.headers,
          }),
        ),
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
            headers: this.headers,
          }),
        ),
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl3}${endpoint}`, {
            headers: this.headers,
          }),
        ),
      ]);

      const notDoneIssues = responses.flatMap((response) => {
        return response.data.issues;
      });

      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

      const user = await this.userModel.findOne({ accountId });

      const existingHistory = user.issueHistory.find((history) => {
        return history.date === date;
      });

      if (notDoneIssues.length === 0) {
        if (existingHistory) {
          existingHistory.issuesCount.notDone = { Task: 0, Bug: 0, Story: 0 };
          existingHistory.notDoneIssues = [];
        } else {
          user.issueHistory.push({
            date: date,
            issuesCount: { notDone: { Task: 0, Bug: 0, Story: 0 } },
            notDoneIssues: [],
          });
        }
        await user.save();
        return;
      }

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

          countsByDate[dueDate][issueType]++;

          const linkedIssues = (issue.fields.issuelinks || [])
            .map((link) => {
              const linkedIssue = link.outwardIssue || link.inwardIssue;
              return linkedIssue
                ? {
                    issueId: linkedIssue.id,
                    issueType: linkedIssue.fields.issuetype.name,
                    summary: linkedIssue.fields.summary,
                    status: linkedIssue.fields.status.name,
                  }
                : null;
            })
            .filter(Boolean);

          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
            issueLinks: linkedIssues,
          });
        }
      });

      if (existingHistory) {
        existingHistory.issuesCount.notDone = countsByDate[date];
        existingHistory.notDoneIssues = issuesByDate[date];
      } else {
        user.issueHistory.push({
          date: date,
          issuesCount: { notDone: countsByDate[date] },
          notDoneIssues: issuesByDate[date],
        });
      }

      await user.save();
      await this.userService.fetchAndSavePlannedIssues(accountId, date);
    } catch (error) {
      handleError(error);
    }
  }

  async countDoneIssues(accountId: string, date: string): Promise<void> {
    try {
      validateAccountId(accountId);
      validateDate(date);
      const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND duedate=${date}`;

      const responses = await Promise.all([
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl1}${endpoint}`, {
            headers: this.headers,
          }),
        ),
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
            headers: this.headers,
          }),
        ),
        lastValueFrom(
          this.httpService.get(`${this.jiraBaseUrl3}${endpoint}`, {
            headers: this.headers,
          }),
        ),
      ]);

      const doneIssues = responses.flatMap((response) => {
        return response.data.issues;
      });

      const countsByDate: {
        [key: string]: {
          Task: number;
          Bug: number;
          Story: number;
          LinkedIssues: number;
        };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

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
              LinkedIssues: 0,
            };
            issuesByDate[dueDate] = [];
          }

          if (issueType === 'Task' && status === 'Done') {
            countsByDate[dueDate].Task++;
          } else if (issueType === 'Bug' && status === 'Done') {
            countsByDate[dueDate].Bug++;
          } else if (
            issueType === 'Story' &&
            (status === 'Done' ||
              status === 'USER STORIES (Verified In Test)' ||
              status === 'USER STORIES (Verified In Beta)')
          ) {
            countsByDate[dueDate].Story++;
          }

          const linkedIssues = (issue.fields.issuelinks || [])
            .map((link) => {
              const linkedIssue = link.outwardIssue || link.inwardIssue;
              return linkedIssue
                ? {
                    issueId: linkedIssue.id,
                    issueType: linkedIssue.fields.issuetype.name,
                    summary: linkedIssue.fields.summary,
                    status: linkedIssue.fields.status.name,
                  }
                : null;
            })
            .filter(Boolean);

          countsByDate[dueDate].LinkedIssues += linkedIssues.length;

          issuesByDate[dueDate].push({
            issueId,
            summary,
            status,
            issueType,
            dueDate,
            issueLinks: linkedIssues,
          });
        }
      }

      const user = await this.userModel.findOne({ accountId });

      for (const [dueDate, counts] of Object.entries(countsByDate)) {
        const existingHistory = user.issueHistory.find((history) => {
          return history.date === dueDate;
        });

        if (existingHistory) {
          existingHistory.issuesCount.done = counts;
          existingHistory.doneIssues = issuesByDate[dueDate];
        } else {
          user.issueHistory.push({
            date: dueDate,
            issuesCount: { done: counts },
            doneIssues: issuesByDate[dueDate],
          });
        }
      }

      await user.save();
      await this.userService.fetchAndSaveAllIssues(accountId, date);
    } catch (error) {
      handleError(error);
    }
  }

  async updateMorningIssueHistory(): Promise<void> {
    try {
      const users = await this.userModel.find().exec();

      const today = new Date(
        new Date().setDate(new Date().getDate()),
      ).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Dhaka',
      });

      const userPromises = users.map(async (user) => {
        if (user.userFrom === 'jira') {
          await this.countPlannedIssues(user.accountId, today);
        }
        if (user.userFrom === 'trello') {
          await this.trelloService.countPlannedIssues(user.accountId, today);
        }
      });

      await Promise.all(userPromises);
    } catch (error) {
      handleError(error);
    }
  }

  async updateEveningIssueHistory(): Promise<void> {
    try {
      const users = await this.userModel.find().exec();

      const today = new Date(
        new Date().setDate(new Date().getDate()),
      ).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Dhaka',
      });

      const userPromises = users.map(async (user) => {
        if (user.userFrom === 'jira') {
          await this.countDoneIssues(user.accountId, today);
        }
        if (user.userFrom === 'trello') {
          await this.trelloService.countDoneIssues(user.accountId, today);
        }
        await this.calculateDailyMetrics(user.accountId, today);
      });

      await Promise.all(userPromises);
    } catch (error) {
      handleError(error);
    }
  }

  async updateMorningIssueHistoryForSpecificDate(date: string): Promise<void> {
    try {
      const users = await this.userModel.find().exec();

      const userPromises = users.map(async (user) => {
        if (user.userFrom === 'jira') {
          await this.countPlannedIssues(user.accountId, date);
        }
        if (user.userFrom === 'trello') {
          await this.trelloService.countPlannedIssues(user.accountId, date);
        }
      });

      await Promise.all(userPromises);
    } catch (error) {
      handleError(error);
    }
  }

  async updateEveningIssueHistoryForSpecificDate(date: string): Promise<void> {
    try {

      const users = await this.userModel.find().exec();

      const userPromises = users.map(async (user) => {
        if (user.userFrom === 'jira') {
          await this.countDoneIssues(user.accountId, date);
        }
        if (user.userFrom === 'trello') {
          await this.trelloService.countDoneIssues(user.accountId, date);
        }
        await this.calculateDailyMetrics(user.accountId, date);
      });

      await Promise.all(userPromises);
    } catch (error) {
      handleError(error);
    }
  }

  async updateMorningIssueHistoryForSpecificUser(
    accountId: string,
    date: string,
  ): Promise<void> {
    try {
      const user = await this.userModel.findOne({ accountId }).exec();

      if (!user) {
        throw new Error('User not found');
      }

      if (user.userFrom === 'jira') {
        await this.countPlannedIssues(user.accountId, date);
      }

      if (user.userFrom === 'trello') {
        await this.trelloService.countPlannedIssues(user.accountId, date);
      }
    } catch (error) {
      handleError(error);
    }
  }

  async updateEveningIssueHistoryForSpecificUser(
    accountId: string,
    date: string,
  ): Promise<void> {
    try {
      const user = await this.userModel.findOne({ accountId }).exec();

      const today = new Date(
        new Date().setDate(new Date().getDate()),
      ).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Dhaka',
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.userFrom === 'jira') {
        await this.countDoneIssues(user.accountId, date);
      }

      if (user.userFrom === 'trello') {
        await this.trelloService.countDoneIssues(user.accountId, date);
      }
      await this.calculateDailyMetrics(user.accountId, today);
    } catch (error) {
      handleError(error);
    }
  }

  async calculateDailyMetrics(
    accountId: string,
    date: string,
  ): Promise<IDailyMetrics> {
    try {
      const user = await this.userModel.findOne({ accountId });
      const issueHistory = user.issueHistory;

      const entry = issueHistory.find((entry) => {
        return entry.date === date;
      });

      const { issuesCount, notDoneIssues, doneIssues } = entry;
      const counts = issuesCount;

      let taskCompletionRate = 0;
      let userStoryCompletionRate = 0;
      let overallScore = 0;
      let comment = '';
      let codeToBugRatio = 0;

      // Calculate not done issue IDs
      const notDoneTaskIds = notDoneIssues
        .filter((issue) => {
          return issue.issueType === 'Task';
        })
        .map((issue) => {
          return issue.issueId;
        });
      const notDoneStoryIds = notDoneIssues
        .filter((issue) => {
          return issue.issueType === 'Story';
        })
        .map((issue) => {
          return issue.issueId;
        });
      const notDoneBugIds = notDoneIssues
        .filter((issue) => {
          return issue.issueType === 'Bug';
        })
        .map((issue) => {
          return issue.issueId;
        });

      // Calculate matched done issue IDs
      const matchedDoneTaskIds = doneIssues
        .filter((issue) => {
          return (
            issue.issueType === 'Task' &&
            issue.status === 'Done' || issue.status === 'In Review'&&
            notDoneTaskIds.includes(issue.issueId)
          );
        })
        .map((issue) => {
          return issue.issueId;
        });

      const matchedDoneStoryIds = doneIssues
        .filter((issue) => {
          return (
            issue.issueType === 'Story' &&
            (issue.status === 'Done' ||
              issue.status === 'USER STORIES (Verified In Test)' ||
              issue.status === 'USER STORIES (Verified In Beta)') &&
            notDoneStoryIds.includes(issue.issueId)
          );
        })
        .map((issue) => {
          return issue.issueId;
        });
      const matchedDoneBugIds = doneIssues
        .filter((issue) => {
          return (
            issue.issueType === 'Bug' &&
            issue.status === 'Done' &&
            notDoneBugIds.includes(issue.issueId)
          );
        })
        .map((issue) => {
          return issue.issueId;
        });

      // Calculate total done issues
      const totalDoneTasks = doneIssues.filter((issue) => {
        return issue.issueType === 'Task' && issue.status === 'Done' || issue.status === 'In Review';
      }).length;

      const totalDoneStories = doneIssues.filter((issue) => {
        return (
          (issue.issueType === 'Story' && issue.status === 'Done') ||
          issue.status === 'USER STORIES (Verified In Test)' ||
          issue.status === 'USER STORIES (Verified In Beta)'
        );
      }).length;

      const totalDoneBugs = doneIssues.filter((issue) => {
        return issue.issueType === 'Bug' && issue.status === 'Done';
      }).length;

      // Calculate completion rates
      const totalNotDoneTasksAndBugs = counts.notDone.Task + counts.notDone.Bug;
      const totalMatchedDoneTasksAndBugs =
        matchedDoneTaskIds.length + matchedDoneBugIds.length;

      if (totalNotDoneTasksAndBugs > 0) {
        taskCompletionRate =
          (totalMatchedDoneTasksAndBugs / totalNotDoneTasksAndBugs) * 100;
      }

      const totalNotDoneStories = counts.notDone.Story;
      const totalMatchedDoneStories = matchedDoneStoryIds.length;

      if (totalNotDoneStories > 0) {
        userStoryCompletionRate =
          (totalMatchedDoneStories / totalNotDoneStories) * 100;
      }

      // Calculate overall score and comments
      const totalAllDoneIssues =
        totalDoneTasks + totalDoneStories + totalDoneBugs;
      const totalNotDoneIssues = totalNotDoneTasksAndBugs + totalNotDoneStories;

      if (totalNotDoneIssues === 0 && totalAllDoneIssues === 0) {
        comment = 'holidays/leave';
      } else if (totalAllDoneIssues > totalNotDoneIssues) {
        comment = `Your target was ${totalNotDoneIssues}, but you completed ${totalAllDoneIssues}.`;
      }

      // Calculate unmatched done issues
      const unmatchedDoneTasks = totalDoneTasks - matchedDoneTaskIds.length;
      const unmatchedDoneStories =
        totalDoneStories - matchedDoneStoryIds.length;
      const unmatchedDoneBugs = totalDoneBugs - matchedDoneBugIds.length;
      const totalUnmatchedDoneIssues =
        unmatchedDoneTasks + unmatchedDoneStories + unmatchedDoneBugs;

      if (totalUnmatchedDoneIssues > 0) {
        comment += ` ${totalUnmatchedDoneIssues} issue(s) that you completed do not match your target issues.`;
      }

      // Calculate overall score
      const nonZeroCompletionRates = [];
      if (totalNotDoneTasksAndBugs > 0)
        nonZeroCompletionRates.push(taskCompletionRate);
      if (totalNotDoneStories > 0)
        nonZeroCompletionRates.push(userStoryCompletionRate);

      if (nonZeroCompletionRates.length > 0) {
        overallScore =
          nonZeroCompletionRates.reduce((sum, rate) => {
            return sum + rate;
          }, 0) / nonZeroCompletionRates.length;
      }

      // Calculate code to bug ratio
      const notDoneIssueIds = notDoneIssues.map((issue) => {
        return issue.issueId;
      });
      const totalCompletedBugs = doneIssues.filter((issue) => {
        return (
          issue.issueType === 'Bug' &&
          issue.status === 'Done' &&
          !notDoneIssueIds.includes(issue.issueId)
        );
      }).length;

      const countedCodeIssueIds = new Set();
      doneIssues.forEach((bug) => {
        if (bug.issueType === 'Bug' && bug.status === 'Done') {
          bug.issueLinks.forEach((link) => {
            const linkedIssueId = link.issueId;
            if (
              matchedDoneTaskIds.includes(linkedIssueId) ||
              matchedDoneStoryIds.includes(linkedIssueId)
            ) {
              countedCodeIssueIds.add(linkedIssueId);
            }
          });
        }
      });

      const totalCompletedCodeIssues = countedCodeIssueIds.size;
      if (totalCompletedCodeIssues > 0 && totalCompletedBugs > 0) {
        codeToBugRatio = parseFloat(
          ((totalCompletedBugs / totalCompletedCodeIssues) * 100).toFixed(2),
        );
      }

      entry.taskCompletionRate = taskCompletionRate;
      entry.userStoryCompletionRate = userStoryCompletionRate;
      entry.overallScore = overallScore;
      entry.comment = comment;
      entry.codeToBugRatio = codeToBugRatio;

      await user.save();
      await this.calculateCurrentPerformance(accountId, date);

      return {
        date,
        numberOfTasks: counts.notDone.Task,
        numberOfBugs: counts.notDone.Bug,
        numberOfUserStories: counts.notDone.Story,
        completedTasks: totalMatchedDoneTasksAndBugs,
        completedUserStories: totalMatchedDoneStories,
        taskCompletionRate,
        userStoryCompletionRate,
        overallScore,
        comment,
        codeToBugRatio,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async calculateCurrentPerformance(
    accountId: string,
    date: string,
  ): Promise<void> {
    try {
      const endDate = new Date(date);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 30);

      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      const user = await this.userModel.findOne({ accountId });

      const issueHistory = user.issueHistory;

      const filteredHistory = issueHistory.filter((entry) => {
        const entryDate = entry.date;
        return entryDate >= formattedStartDate && entryDate <= formattedEndDate;
      });

      let totalScore = 0;
      let validDaysCount = 0;

      filteredHistory.forEach((entry) => {
        if (entry.comment !== 'holidays/leave') {
          totalScore += entry.overallScore;
          validDaysCount++;
        }
      });

      const currentPerformance =
        validDaysCount > 0 ? totalScore / validDaysCount : 0;

      user.currentPerformance = currentPerformance;
      await user.save();
    } catch (error) {
      handleError(error);
    }
  }
}
