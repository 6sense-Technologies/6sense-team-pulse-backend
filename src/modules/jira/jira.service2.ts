import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
  } from '@nestjs/common';
  import { HttpService } from '@nestjs/axios';
  import * as dotenv from 'dotenv';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import {
    Designation,
    IIssue,
    Project,
    User,
  } from '../users/schemas/user.schema';
  import {
    IGetUserIssuesResponse,
    IJiraUserData,
  } from '../../common/interfaces/jira.interfaces';
  import { TrelloService } from '../trello/trello.service';
  import { UserService } from '../users/users.service';
  import { AxiosErrorHelper } from 'src/common/helpers/axios-exception.helper';
  import { firstValueFrom, lastValueFrom } from 'rxjs';
  import { handleError } from 'src/common/helpers/error.helper';
  
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
      private readonly trelloService: TrelloService,
      private readonly userService: UserService,
      @InjectModel(User.name) private readonly userModel: Model<User>,
    ) {
      // Constructor for injecting userModel
    }
  
    private async fetchFromBothUrls(endpoint: string) {
      try {
        const url1 = `${this.jiraBaseUrl}${endpoint}`;
        const url2 = `${this.jiraBaseUrl2}${endpoint}`;
  
        const [response1, response2] = await Promise.all([
          this.httpService.get(url1, { headers: this.headers }).toPromise(),
          this.httpService.get(url2, { headers: this.headers }).toPromise(),
        ]);
  
        return {
          fromUrl1: response1.data,
          fromUrl2: response2.data,
        };
      } catch (error) {
        const errorResponse =
          AxiosErrorHelper.getInstance().handleAxiosApiError(error);
        throw new HttpException(errorResponse, errorResponse.status);
      }
    }
  
    async getUserDetails(accountId: string): Promise<IJiraUserData> {
      const endpoint = `/rest/api/3/user?accountId=${accountId}`;
  
      try {
        const response1 = await firstValueFrom(
          this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, {
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
          } catch (error) {
            const errorResponse =
              AxiosErrorHelper.getInstance().handleAxiosApiError(error);
            throw new HttpException(errorResponse, errorResponse.status);
          }
        }
  
        const errorResponse =
          AxiosErrorHelper.getInstance().handleAxiosApiError(error);
        throw new HttpException(errorResponse, errorResponse.status);
      }
    }
  
    async getUserIssues(
      accountId: string,
      date: string,
    ): Promise<IGetUserIssuesResponse[]> {
      try {
        const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND duedate=${date}`;
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
            storypoints: issue.fields.customfield_10016,
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
        const errorResponse =
          AxiosErrorHelper.getInstance().handleAxiosApiError(error);
        throw new HttpException(errorResponse, errorResponse.status);
      }
    }
  
    async fetchAndSaveUser(
      accountId: string,
      userFrom: string,
      designation: Designation,
      project: Project,
    ): Promise<{ statusCode: number; message: string; user?: User }> {
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
          currentPerformance: userDetails.currentPerformance || 0,
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
  
    async countPlannedIssues(accountId: string, date: string): Promise<void> {
      const formattedDate = new Date(date).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Dhaka',
      });
  
      const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate=${formattedDate}`;
  
      try {
        const [response1, response2] = await Promise.all([
          lastValueFrom(
            this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, {
              headers: this.headers,
            }),
          ),
          lastValueFrom(
            this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
              headers: this.headers,
            }),
          ),
        ]);
  
        const notDoneIssues = [
          ...response1.data.issues,
          ...response2.data.issues,
        ];
  
        const countsByDate: {
          [key: string]: { Task: number; Bug: number; Story: number };
        } = {};
        const issuesByDate: { [key: string]: IIssue[] } = {};
  
        if (notDoneIssues.length === 0) {
          const user = await this.userModel.findOne({ accountId });
  
          user.issueHistory.push({
            date: formattedDate,
            issuesCount: { notDone: { Task: 0, Bug: 0, Story: 0 } },
            notDoneIssues: [],
          });
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
  
            // Extract issue links
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
  
        const user = await this.userModel.findOne({ accountId });
  
        const existingHistory = user.issueHistory.find(
          (history) => history.date === formattedDate,
        );
  
        if (existingHistory) {
          existingHistory.issuesCount.notDone = countsByDate[formattedDate];
          existingHistory.notDoneIssues = issuesByDate[formattedDate];
        } else {
          user.issueHistory.push({
            date: formattedDate,
            issuesCount: { notDone: countsByDate[formattedDate] },
            notDoneIssues: issuesByDate[formattedDate],
          });
        }
  
        await user.save();
  
        await this.userService.fetchAndSavePlannedIssues(
          accountId,
          formattedDate,
        );
      } catch (error) {
        handleError(error);
      }
    }
  
    async countDoneIssues(accountId: string, date: string): Promise<void> {
  
      const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND duedate=${date}`;
  
      try {
        const [response1, response2] = await Promise.all([
          lastValueFrom(
            this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, {
              headers: this.headers,
            }),
          ),
          lastValueFrom(
            this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
              headers: this.headers,
            }),
          ),
        ]);
  
        const doneIssues = [...response1.data.issues, ...response2.data.issues];
  
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
  
            // Count the issue types only if the status is 'Done'
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
  
        // Update user's issue history
        const user = await this.userModel.findOne({ accountId });
  
        for (const [date, counts] of Object.entries(countsByDate)) {
          const existingHistory = user.issueHistory.find(
            (history) => history.date === date,
          );
  
          if (existingHistory) {
            existingHistory.issuesCount.done = counts;
            existingHistory.doneIssues = issuesByDate[date];
          } else {
            user.issueHistory.push({
              date,
              issuesCount: { done: counts },
              doneIssues: issuesByDate[date],
            });
          }
        }
  
        await user.save();
  
        await this.userService.fetchAndSaveAllIssues(
          accountId,
          date,
        );
      } catch (error) {
        handleError(error);
      }
    }
  
    async updateMorningIssueHistory(): Promise<void> {
      try {
        const users = await this.userModel.find().exec();
  
        const today = new Date().toLocaleDateString('en-CA', {
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
          new Date().setDate(new Date().getDate() - 1),
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
        });
  
        await Promise.all(userPromises);
      } catch (error) {
        handleError(error);
      }
    }
  
    // async getUserMetricsByAccountId(accountId: string, date: string) {
    //   try {
    //     const user = await this.userModel.findOne({ accountId }).exec();
    //     if (!user) {
    //       return { message: 'User not found' };
    //     }
  
    //     const issueHistory = user.issueHistory;
  
    //     // Directly match the provided date
    //     const entryForTheDay = issueHistory.find((entry) => entry.date === date);
  
    //     if (!entryForTheDay) {
    //       return { message: `No data available for the date: ${date}` };
    //     }
  
    //     const { issuesCount, notDoneIssues, doneIssues } = entryForTheDay;
  
    //     // Calculation for only the specific day's metrics
    //     const counts = issuesCount;
    //     let taskCompletionRate = 0;
    //     let userStoryCompletionRate = 0;
    //     let overallScore = 0;
    //     let bugToTaskRatio = 0;
    //     let codeToBugRatio = 0;
    //     let comment = '';
  
    //     const notDoneTaskIds = notDoneIssues
    //       .filter((issue) => issue.issueType === 'Task')
    //       .map((issue) => issue.issueId);
  
    //     const notDoneStoryIds = notDoneIssues
    //       .filter((issue) => issue.issueType === 'Story')
    //       .map((issue) => issue.issueId);
  
    //     const notDoneBugIds = notDoneIssues
    //       .filter((issue) => issue.issueType === 'Bug')
    //       .map((issue) => issue.issueId);
  
    //     const matchedDoneTaskIds = doneIssues
    //       .filter(
    //         (issue) =>
    //           issue.issueType === 'Task' &&
    //           issue.status === 'Done' &&
    //           notDoneTaskIds.includes(issue.issueId),
    //       )
    //       .map((issue) => issue.issueId);
  
    //     const matchedDoneStoryIds = doneIssues
    //       .filter(
    //         (issue) =>
    //           issue.issueType === 'Story' &&
    //           (issue.status === 'Done' ||
    //             issue.status === 'USER STORIES (Verified In Test)' ||
    //             issue.status === 'USER STORIES (Verified In Beta)') &&
    //           notDoneStoryIds.includes(issue.issueId),
    //       )
    //       .map((issue) => issue.issueId);
  
    //     const matchedDoneBugIds = doneIssues
    //       .filter(
    //         (issue) =>
    //           issue.issueType === 'Bug' &&
    //           issue.status === 'Done' &&
    //           notDoneBugIds.includes(issue.issueId),
    //       )
    //       .map((issue) => issue.issueId);
  
    //     const totalDoneTasks = doneIssues.filter(
    //       (issue) => issue.issueType === 'Task' && issue.status === 'Done',
    //     ).length;
  
    //     const totalDoneStories = doneIssues.filter(
    //       (issue) =>
    //         (issue.issueType === 'Story' && issue.status === 'Done') ||
    //         issue.status === 'USER STORIES (Verified In Test)' ||
    //         issue.status === 'USER STORIES (Verified In Beta)',
    //     ).length;
  
    //     const totalDoneBugs = doneIssues.filter(
    //       (issue) => issue.issueType === 'Bug' && issue.status === 'Done',
    //     ).length;
  
    //     const totalNotDoneTasksAndBugs = counts.notDone.Task + counts.notDone.Bug;
    //     const totalMatchedDoneTasksAndBugs =
    //       matchedDoneTaskIds.length + matchedDoneBugIds.length;
  
    //     if (totalNotDoneTasksAndBugs > 0) {
    //       taskCompletionRate =
    //         (totalMatchedDoneTasksAndBugs / totalNotDoneTasksAndBugs) * 100;
    //     }
  
    //     const totalNotDoneStories = counts.notDone.Story;
    //     const totalMatchedDoneStories = matchedDoneStoryIds.length;
  
    //     if (totalNotDoneStories > 0) {
    //       userStoryCompletionRate =
    //         (totalMatchedDoneStories / totalNotDoneStories) * 100;
    //     }
  
    //     const nonZeroCompletionRates = [];
    //     if (totalNotDoneTasksAndBugs > 0) {
    //       nonZeroCompletionRates.push(taskCompletionRate);
    //     }
    //     if (totalNotDoneStories > 0) {
    //       nonZeroCompletionRates.push(userStoryCompletionRate);
    //     }
  
    //     if (nonZeroCompletionRates.length > 0) {
    //       overallScore =
    //         nonZeroCompletionRates.reduce((sum, rate) => sum + rate, 0) /
    //         nonZeroCompletionRates.length;
    //     }
  
    //     const totalAllDoneIssues =
    //       totalDoneTasks + totalDoneStories + totalDoneBugs;
    //     const totalNotDoneIssues = totalNotDoneTasksAndBugs + totalNotDoneStories;
  
    //     if (
    //       totalNotDoneTasksAndBugs === 0 &&
    //       totalMatchedDoneTasksAndBugs === 0
    //     ) {
    //       comment = 'holidays/leave';
    //     } else if (totalAllDoneIssues > totalNotDoneIssues) {
    //       comment = `Your target was ${totalNotDoneIssues}, but you completed ${totalAllDoneIssues}.`;
    //     }
  
    //     // Code-to-Bug ratio calculation
  
    //     let totalCompletedCodeIssues = 0;
  
    //     // Get the IDs of issues that are not done
    //     const notDoneIssueIds = notDoneIssues.map((issue) => issue.issueId);
  
    //     // Count total completed bugs
    //     const totalCompletedBugs = doneIssues.filter(
    //       (issue) =>
    //         issue.issueType === 'Bug' &&
    //         issue.status === 'Done' &&
    //         !notDoneIssueIds.includes(issue.issueId), // Exclude bugs that are linked to not done issues
    //     ).length;
  
    //     // Create a Set to keep track of counted code issues to avoid duplicates
    //     const countedCodeIssueIds = new Set();
  
    //     doneIssues.forEach((bug) => {
    //       // Check if the bug is completed
    //       if (bug.issueType === 'Bug' && bug.status === 'Done') {
    //         // Loop through the issue links of the bug
    //         bug.issueLinks.forEach((link) => {
    //           const linkedIssueId = link.issueId;
    //           // Check if the linked issue ID matches any done task or story IDs
    //           if (
    //             matchedDoneTaskIds.includes(linkedIssueId) ||
    //             matchedDoneStoryIds.includes(linkedIssueId)
    //           ) {
    //             // Add the linked issue ID to the Set to ensure uniqueness
    //             countedCodeIssueIds.add(linkedIssueId);
    //           }
    //         });
    //       }
    //     });
  
    //     // The total unique completed code issues count
    //     totalCompletedCodeIssues = countedCodeIssueIds.size;
  
    //     // Calculate the code-to-bug ratio
    //     if (totalCompletedCodeIssues > 0 && totalCompletedBugs > 0) {
    //       codeToBugRatio = parseFloat(
    //         ((totalCompletedBugs / totalCompletedCodeIssues) * 100).toFixed(2),
    //       );
    //     }
  
    //     const dailyMetrics = {
    //       date: entryForTheDay.date,
    //       numberOfTasks: counts.notDone.Task,
    //       numberOfBugs: counts.notDone.Bug,
    //       numberOfUserStories: counts.notDone.Story,
    //       completedTasks: totalMatchedDoneTasksAndBugs,
    //       completedUserStories: totalMatchedDoneStories,
    //       taskCompletionRate: taskCompletionRate || 0,
    //       userStoryCompletionRate: userStoryCompletionRate || 0,
    //       bugToTaskRatio: bugToTaskRatio || 0,
    //       codeToBugRatio: codeToBugRatio || 0,
    //       overallScore: overallScore || 0,
    //       comment,
    //     };
  
    //     // Calculate performance for the last 30 days using the helper function
    //     const last30DaysPerformance =
    //       await this.CurrentPerformanceOf30Days(
    //         user,
    //         new Date(date),
    //       );
  
    //     user.currentPerformance = last30DaysPerformance;
    //     await user.save();
  
    //     return {
    //       message: 'Metrics calculated successfully',
    //       dailyMetrics,
    //       last30DaysPerformance,
    //     };
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  
    // public CurrentPerformanceOf30Days(
    //   user: any,
    //   date: Date,
    // ): Promise<number> {
    //   return new Promise((resolve) => {
    //     const currentDate = new Date(date);
    //     const last30days = new Date(currentDate);
    //     last30days.setDate(currentDate.getDate() - 30);
  
    //     // Filter the user's issue history for the relevant date range
    //     const recentHistory = user.issueHistory.filter((entry: any) => {
    //       const entryDate = new Date(entry.date);
    //       return entryDate >= last30days && entryDate <= currentDate;
    //     });
  
    //     // Process metrics for each day in the last 30 days
    //     const metricsByDay = recentHistory.map((entry: any) => {
    //       if (entry.comment === 'holidays/leave') {
    //         return null; // Ignore holidays or leave days
    //       }
    //       return entry.overallScore;
    //     });
  
    //     // Filter out null values
    //     const validScores = metricsByDay.filter(
    //       (score: number | null) => score !== null,
    //     );
  
    //     const totalScore = validScores.reduce(
    //       (sum: number, score: number) => sum + score,
    //       0,
    //     );
    //     const validDaysCount = validScores.length;
  
    //     // Avoid division by zero and resolve the Promise with the result
    //     resolve(validDaysCount > 0 ? totalScore / validDaysCount : 0);
    //   });
    // }
  
    async getAllUserMetrics() {
      try {
        const users = await this.userModel.find({}).exec();
        const currentDate = new Date();
        const last30days = new Date();
        last30days.setDate(currentDate.getDate() - 30);
  
        await Promise.all(
          users.map(async (user) => {
            const issueHistory = user.issueHistory;
  
            // Filter issue history for the last 30 days
            const recentHistory = issueHistory.filter((entry) => {
              const entryDate = new Date(entry.date);
              return entryDate >= last30days && entryDate <= currentDate;
            });
  
            const metricsByDay = await Promise.all(
              recentHistory.map(async (entry) => {
                const { date, issuesCount, notDoneIssues, doneIssues } = entry;
                const counts = issuesCount;
  
                let taskCompletionRate = 0;
                let userStoryCompletionRate = 0;
                let overallScore = 0;
                let comment = '';
  
                // Map not done task, story, and bug IDs
                const notDoneTaskIds = notDoneIssues
                  .filter((issue) => issue.issueType === 'Task')
                  .map((issue) => issue.issueId);
  
                const notDoneStoryIds = notDoneIssues
                  .filter((issue) => issue.issueType === 'Story')
                  .map((issue) => issue.issueId);
  
                const notDoneBugIds = notDoneIssues
                  .filter((issue) => issue.issueType === 'Bug')
                  .map((issue) => issue.issueId);
  
                // Filter done issues to count matched ones
                const matchedDoneTaskIds = doneIssues
                  .filter(
                    (issue) =>
                      issue.issueType === 'Task' &&
                      issue.status === 'Done' &&
                      notDoneTaskIds.includes(issue.issueId),
                  )
                  .map((issue) => issue.issueId);
  
                const matchedDoneStoryIds = doneIssues
                  .filter(
                    (issue) =>
                      issue.issueType === 'Story' &&
                      (issue.status === 'Done' ||
                        issue.status === 'USER STORIES (Verified In Test)' ||
                        issue.status === 'USER STORIES (Verified In Beta)') &&
                      notDoneStoryIds.includes(issue.issueId),
                  )
                  .map((issue) => issue.issueId);
  
                const matchedDoneBugIds = doneIssues
                  .filter(
                    (issue) =>
                      issue.issueType === 'Bug' &&
                      issue.status === 'Done' &&
                      notDoneBugIds.includes(issue.issueId),
                  )
                  .map((issue) => issue.issueId);
  
                // Count total done tasks, stories, and bugs (both matched and unmatched)
                const totalDoneTasks = doneIssues.filter(
                  (issue) =>
                    issue.issueType === 'Task' && issue.status === 'Done',
                ).length;
  
                const totalDoneStories = doneIssues.filter(
                  (issue) =>
                    (issue.issueType === 'Story' && issue.status === 'Done') ||
                    issue.status === 'USER STORIES (Verified In Test)' ||
                    issue.status === 'USER STORIES (Verified In Beta)',
                ).length;
  
                const totalDoneBugs = doneIssues.filter(
                  (issue) => issue.issueType === 'Bug' && issue.status === 'Done',
                ).length;
  
                // Total not done issues for comparison
                const totalNotDoneTasksAndBugs =
                  counts.notDone.Task + counts.notDone.Bug;
                const totalMatchedDoneTasksAndBugs =
                  matchedDoneTaskIds.length + matchedDoneBugIds.length;
  
                // Calculate task completion rate (only matched)
                if (totalNotDoneTasksAndBugs > 0) {
                  taskCompletionRate =
                    (totalMatchedDoneTasksAndBugs / totalNotDoneTasksAndBugs) *
                    100;
                }
  
                // Calculate user story completion rate (only matched)
                const totalNotDoneStories = counts.notDone.Story;
                const totalMatchedDoneStories = matchedDoneStoryIds.length;
  
                if (totalNotDoneStories > 0) {
                  userStoryCompletionRate =
                    (totalMatchedDoneStories / totalNotDoneStories) * 100;
                }
  
                // Compare all done vs. not done issues for the comment
                const totalAllDoneIssues =
                  totalDoneTasks + totalDoneStories + totalDoneBugs;
                const totalNotDoneIssues =
                  totalNotDoneTasksAndBugs + totalNotDoneStories;
  
                // Check if both total and completed tasks are zero
                if (
                  totalNotDoneTasksAndBugs === 0 &&
                  totalMatchedDoneTasksAndBugs === 0
                ) {
                  comment = 'holidays/leave';
                } else if (totalAllDoneIssues > totalNotDoneIssues) {
                  comment = `Your target was ${totalNotDoneIssues}, but you completed ${totalAllDoneIssues}.`;
                }
  
                // Calculate unmatched done issues
                const unmatchedDoneTasks =
                  totalDoneTasks - matchedDoneTaskIds.length;
                const unmatchedDoneStories =
                  totalDoneStories - matchedDoneStoryIds.length;
                const unmatchedDoneBugs =
                  totalDoneBugs - matchedDoneBugIds.length;
  
                const totalUnmatchedDoneIssues =
                  unmatchedDoneTasks + unmatchedDoneStories + unmatchedDoneBugs;
  
                if (totalUnmatchedDoneIssues > 0) {
                  comment += ` ${totalUnmatchedDoneIssues} issue(s) that you completed do not match your target issues.`;
                }
  
                // Aggregate scores for tasks, stories, and bugs
                const nonZeroCompletionRates = [];
                if (totalNotDoneTasksAndBugs > 0) {
                  nonZeroCompletionRates.push(taskCompletionRate);
                }
                if (totalNotDoneStories > 0) {
                  nonZeroCompletionRates.push(userStoryCompletionRate);
                }
  
                if (nonZeroCompletionRates.length > 0) {
                  overallScore =
                    nonZeroCompletionRates.reduce((sum, rate) => {
                      return sum + rate;
                    }, 0) / nonZeroCompletionRates.length;
                }
  
                let totalCompletedCodeIssues = 0;
  
                // Get the IDs of issues that are not done
                const notDoneIssueIds = notDoneIssues.map(
                  (issue) => issue.issueId,
                );
  
                // Count total completed bugs
                const totalCompletedBugs = doneIssues.filter(
                  (issue) =>
                    issue.issueType === 'Bug' &&
                    issue.status === 'Done' &&
                    !notDoneIssueIds.includes(issue.issueId), // Exclude bugs that are linked to not done issues
                ).length;
  
                // Create a Set to keep track of counted code issues to avoid duplicates
                const countedCodeIssueIds = new Set();
  
                doneIssues.forEach((bug) => {
                  // Check if the bug is completed
                  if (bug.issueType === 'Bug' && bug.status === 'Done') {
                    // Loop through the issue links of the bug
                    bug.issueLinks.forEach((link) => {
                      const linkedIssueId = link.issueId;
                      // Check if the linked issue ID matches any done task or story IDs
                      if (
                        matchedDoneTaskIds.includes(linkedIssueId) ||
                        matchedDoneStoryIds.includes(linkedIssueId)
                      ) {
                        // Add the linked issue ID to the Set to ensure uniqueness
                        countedCodeIssueIds.add(linkedIssueId);
                      }
                    });
                  }
                });
  
                // The total unique completed code issues count
                totalCompletedCodeIssues = countedCodeIssueIds.size;
  
                let codeToBugRatio = 0;
  
                // Calculate the code to bug ratio
                if (totalCompletedCodeIssues > 0 && totalCompletedBugs > 0) {
                  codeToBugRatio = parseFloat(
                    (
                      (totalCompletedBugs / totalCompletedCodeIssues) *
                      100
                    ).toFixed(2),
                  );
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
                entry.codeToBugRatio = codeToBugRatio;
  
                return {
                  date,
                  numberOfTasks: counts.notDone.Task,
                  numberOfBugs: counts.notDone.Bug,
                  numberOfUserStories: counts.notDone.Story,
                  completedTasks: totalMatchedDoneTasksAndBugs,
                  completedUserStories: totalMatchedDoneStories,
                  taskCompletionRate: taskCompletionRateNum,
                  userStoryCompletionRate: userStoryCompletionRateNum,
                  overallScore: overallScoreNum,
                  comment,
                  codeToBugRatio,
                };
              }),
            );
  
            // Calculate current performance for the last 30 days, excluding holidays/leave comments
            const totalScore = metricsByDay.reduce((sum, day) => {
              if (day.comment === 'holidays/leave') {
                return sum;
              }
              return sum + day.overallScore;
            }, 0);
  
            const validDaysCount = metricsByDay.filter((day) => {
              return day.comment !== 'holidays/leave';
            }).length;
            const currentPerformance =
              validDaysCount > 0 ? totalScore / validDaysCount : 0;
  
            user.currentPerformance = currentPerformance;
            user.issueHistory = issueHistory;
            await user.save();
  
            return user;
          }),
        );
  
        return {
          message: 'User metrics calculated successfully',
        };
      } catch (error) {
        handleError(error);
      }
    }
  
    // async countPlannedIssues(accountId: string, date: string): Promise<void> {
    //   const formattedDate = new Date(date).toLocaleDateString('en-CA', {
    //     timeZone: 'Asia/Dhaka',
    //   });
  
    //   const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND status!=Done AND duedate=${formattedDate}`;
  
    //   try {
    //     const [response1, response2] = await Promise.all([
    //       lastValueFrom(
    //         this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, {
    //           headers: this.headers,
    //         }),
    //       ),
    //       lastValueFrom(
    //         this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
    //           headers: this.headers,
    //         }),
    //       ),
    //     ]);
  
    //     const notDoneIssues = [
    //       ...response1.data.issues,
    //       ...response2.data.issues,
    //     ];
  
    //     const countsByDate: {
    //       [key: string]: { Task: number; Bug: number; Story: number };
    //     } = {};
    //     const issuesByDate: { [key: string]: IIssue[] } = {};
  
    //     if (notDoneIssues.length === 0) {
    //       // If no issues found, save with zero counts
    //       await this.savePlannedIssueCounts(
    //         accountId,
    //         formattedDate,
    //         { Task: 0, Bug: 0, Story: 0 },
    //         [],
    //       );
    //       return;
    //     }
  
    //     notDoneIssues.forEach((issue) => {
    //       const dueDate = issue.fields.duedate?.split('T')[0];
    //       const issueType = issue.fields.issuetype.name;
    //       const issueId = issue.id;
    //       const summary = issue.fields.summary;
    //       const status = issue.fields.status.name;
  
    //       if (dueDate) {
    //         if (!countsByDate[dueDate]) {
    //           countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
    //           issuesByDate[dueDate] = [];
    //         }
  
    //         if (issueType === 'Task') {
    //           countsByDate[dueDate].Task++;
    //         } else if (issueType === 'Bug') {
    //           countsByDate[dueDate].Bug++;
    //         } else if (issueType === 'Story') {
    //           countsByDate[dueDate].Story++;
    //         }
  
    //         // Extract issue links
    //         const issueLinks = issue.fields.issuelinks || [];
    //         const linkedIssues = issueLinks
    //           .map((link) => {
    //             const linkedIssue = link.outwardIssue || link.inwardIssue;
    //             return linkedIssue
    //               ? {
    //                   issueId: linkedIssue.id,
    //                   issueType: linkedIssue.fields.issuetype.name,
    //                   summary: linkedIssue.fields.summary,
    //                   status: linkedIssue.fields.status.name,
    //                 }
    //               : null;
    //           })
    //           .filter(Boolean);
  
    //         issuesByDate[dueDate].push({
    //           issueId,
    //           summary,
    //           status,
    //           issueType,
    //           dueDate,
    //           issueLinks: linkedIssues,
    //         });
    //       }
    //     });
  
    //     for (const [date, counts] of Object.entries(countsByDate)) {
    //       await this.savePlannedIssueCounts(
    //         accountId,
    //         date,
    //         counts,
    //         issuesByDate[date],
    //       );
    //     }
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  
    // async savePlannedIssueCounts(
    //   accountId: string,
    //   date: string,
    //   counts: { Task: number; Bug: number; Story: number },
    //   issues: IIssue[],
    // ): Promise<void> {
    //   try {
    //     const user = await this.userModel.findOne({ accountId });
  
    //     if (!user) {
    //       throw new InternalServerErrorException('User not found');
    //     }
  
    //     // Update user's issue history
    //     const existingHistory = user.issueHistory.find((history) => {
    //       return history.date === date;
    //     });
  
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
    //     handleError(error);
    //   }
    // }
  
    // async countDoneIssues(accountId: string, date: string): Promise<void> {
    //   const formattedDate = new Date(date).toLocaleDateString('en-CA', {
    //     timeZone: 'Asia/Dhaka',
    //   });
  
    //   const endpoint = `/rest/api/3/search?jql=assignee=${accountId} AND duedate=${formattedDate}`;
  
    //   try {
    //     const [response1, response2] = await Promise.all([
    //       lastValueFrom(
    //         this.httpService.get(`${this.jiraBaseUrl}${endpoint}`, {
    //           headers: this.headers,
    //         }),
    //       ),
    //       lastValueFrom(
    //         this.httpService.get(`${this.jiraBaseUrl2}${endpoint}`, {
    //           headers: this.headers,
    //         }),
    //       ),
    //     ]);
  
    //     const doneIssues = [...response1.data.issues, ...response2.data.issues];
  
    //     const countsByDate: {
    //       [key: string]: {
    //         Task: number;
    //         Bug: number;
    //         Story: number;
    //         LinkedIssues: number;
    //       };
    //     } = {};
    //     const issuesByDate: { [key: string]: IIssue[] } = {};
  
    //     for (const issue of doneIssues) {
    //       const dueDate = issue.fields.duedate?.split('T')[0];
    //       const issueType = issue.fields.issuetype.name;
    //       const issueId = issue.id;
    //       const summary = issue.fields.summary;
    //       const status = issue.fields.status.name;
  
    //       if (dueDate) {
    //         if (!countsByDate[dueDate]) {
    //           countsByDate[dueDate] = {
    //             Task: 0,
    //             Bug: 0,
    //             Story: 0,
    //             LinkedIssues: 0,
    //           };
    //           issuesByDate[dueDate] = [];
    //         }
  
    //         // Count the issue types only if the status is 'Done'
    //         if (issueType === 'Task' && status === 'Done') {
    //           countsByDate[dueDate].Task++;
    //         } else if (issueType === 'Bug' && status === 'Done') {
    //           countsByDate[dueDate].Bug++;
    //         } else if (
    //           issueType === 'Story' &&
    //           (status === 'Done' ||
    //             status === 'USER STORIES (Verified In Test)' ||
    //             status === 'USER STORIES (Verified In Beta)')
    //         ) {
    //           countsByDate[dueDate].Story++;
    //         }
  
    //         const issueLinks = issue.fields.issuelinks || [];
    //         const linkedIssues = issueLinks
    //           .map((link) => {
    //             const linkedIssue = link.outwardIssue || link.inwardIssue;
    //             return linkedIssue
    //               ? {
    //                   issueId: linkedIssue.id,
    //                   issueType: linkedIssue.fields.issuetype.name,
    //                   summary: linkedIssue.fields.summary,
    //                   status: linkedIssue.fields.status.name,
    //                 }
    //               : null;
    //           })
    //           .filter(Boolean);
  
    //         countsByDate[dueDate].LinkedIssues += linkedIssues.length;
  
    //         issuesByDate[dueDate].push({
    //           issueId,
    //           summary,
    //           status,
    //           issueType,
    //           dueDate,
    //           issueLinks: linkedIssues,
    //         });
    //       }
    //     }
  
    //     for (const [date, counts] of Object.entries(countsByDate)) {
    //       await this.saveDoneIssueCounts(
    //         accountId,
    //         date,
    //         counts,
    //         issuesByDate[date],
    //       );
    //     }
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  
    // async saveDoneIssueCounts(
    //   accountId: string,
    //   date: string,
    //   counts: { Task: number; Bug: number; Story: number },
    //   issues: IIssue[],
    // ): Promise<void> {
    //   try {
    //     const user = await this.userModel.findOne({ accountId });
  
    //     if (!user) {
    //       throw new InternalServerErrorException('User not found');
    //     }
  
    //     // Update user's issue history
    //     const existingHistory = user.issueHistory.find((history) => {
    //       return history.date === date;
    //     });
  
    //     if (existingHistory) {
    //       existingHistory.issuesCount.done = counts;
    //       existingHistory.doneIssues = issues;
    //     } else {
    //       user.issueHistory.push({
    //         date,
    //         issuesCount: { done: counts },
    //         doneIssues: issues,
    //       });
    //     }
  
    //     await user.save();
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  
    // async updateMorningIssueHistory(): Promise<void> {
    //   try {
    //     const users = await this.userModel.find().exec();
  
    //     const today = new Date(
    //       new Date().setDate(new Date().getDate()),
    //     ).toLocaleDateString('en-CA', {
    //       timeZone: 'Asia/Dhaka',
    //     });
  
    //     for (const user of users) {
    //       if (user.userFrom === 'jira') {
    //         await this.countPlannedIssues(user.accountId, today);
    //       }
    //       if (user.userFrom === 'trello') {
    //         await this.trelloService.countPlannedIssues(user.accountId, today);
    //       }
    //       await this.userService.fetchAndSavePlannedIssues(user.accountId, today);
    //     }
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  
    // async updateEveningIssueHistory(): Promise<void> {
    //   try {
    //     const users = await this.userModel.find().exec();
  
    //     const today = new Date(
    //       new Date().setDate(new Date().getDate() - 1),
    //     ).toLocaleDateString('en-CA', {
    //       timeZone: 'Asia/Dhaka',
    //     });
  
    //     for (const user of users) {
    //       if (user.userFrom === 'jira') {
    //         await this.countDoneIssues(user.accountId, today);
    //       }
    //       if (user.userFrom === 'trello') {
    //         await this.trelloService.countDoneIssues(user.accountId, today);
    //       }
    //       await this.userService.fetchAndSaveAllIssues(user.accountId, today);
    //     }
    //   } catch (error) {
    //     handleError(error);
    //   }
    // }
  }
  