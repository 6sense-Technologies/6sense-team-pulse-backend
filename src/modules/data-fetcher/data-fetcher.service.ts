import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
// import { EnvironmentVariables } from 'src/interfaces/config';
import { DataFetcherDTO } from './dto/data-fetcher.dto';
import { Tool } from '../../schemas/Tool.schema';
import mongoose, { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { JiraService } from '../jira/jira.service';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { Users } from '../../schemas/users.schema';
import { LinearService } from '../linear/linear.service';
import { Cron } from '@nestjs/schedule';
// import * as moment from 'moment';
@Injectable()
export class DataFetcherService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectModel(Tool.name)
    private readonly toolModel: Model<Tool>,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
    @InjectModel(Users.name)
    private readonly userModel: Model<Users>,
    private readonly linearService: LinearService,
  ) {}
  private getTime(dateTime) {
    // Parse the input dateTime string into a Date object
    // console.log(`Before Formating: ${dateTime}`);
    const date = new Date(dateTime);

    // Convert to Bangladesh Time (UTC+6)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    // Format the time for Bangladesh (UTC+6)
    const formattedTime = date.toLocaleTimeString('en-BD', options);
    // console.log(`After formating ${formattedTime}`);
    // Extract hour and minute from the formatted time
    const amPm = formattedTime.split(' ')[1];
    const [hour, minute] = formattedTime.split(' ')[0].split(':').map(Number);

    // Return the result as an object
    return { hour, minute, amPm };
  }

  async dataFetchFromJIRA(dataFetcherdto: DataFetcherDTO) {
    // console.log(dataFetcherdto);
    const emailAddress = this.configService.get('EMAIL_ADDRESS');
    const accessToken = this.configService.get('ACCESS_TOKEN');
    // console.log(dataFetcherdto.projectUrl);
    // console.log(emailAddress);
    // console.log(accessToken);
    const url = `${dataFetcherdto.projectUrl}/rest/api/2/search`;
    const headers = {
      Authorization: `Basic ${Buffer.from(`${emailAddress}:${accessToken}`).toString('base64')}`,
      Accept: 'application/json',
    };
    const now = new Date();
    const bangladeshOffset = 6 * 60 * 60 * 1000; // UTC+6 in milliseconds
    const todaysDate =
      dataFetcherdto.date || new Date(now.getTime() + bangladeshOffset).toISOString().split('T')[0];
    console.log(`Fetching datas for date greater than equal : ${todaysDate}`);
    // const tempDate = '2024-08-01';
    const jqlQuery = {
      jql: `created >= '${todaysDate}' OR due >= '${todaysDate}'`,
      fields: [
        'id',
        'key',
        'summary',
        'status',
        'assignee',
        'priority',
        'created',
        'issuetype',
        'duedate',
        'issuelinks',
        'resolutiondate',
        'Due date',
      ],
    };

    const maxResults = 100;
    let startAt = 0;
    let total = 0;
    const allIssues = [];
    try {
      do {
        const paginatedQuery = {
          ...jqlQuery,
          startAt,
          maxResults,
        };

        const response = await firstValueFrom(
          this.httpService.post(url, paginatedQuery, { headers }),
        );
        const { issues, total: totalIssues } = response.data;
        allIssues.push(...issues);
        total = totalIssues;

        startAt += maxResults;
      } while (startAt < total);
      const accountIds = new Set();
      const transformedIssue = allIssues.map((issue) => {
        // console.log(issue);
        const dueDate = issue.fields.duedate;
        const projectUrl = dataFetcherdto.projectUrl;
        const projectKey = issue['key'];
        const issueIdUrl = projectUrl + '/browse/' + projectKey;

        // const resolutionDate = issue.fields.resolutiondate;
        let createdDate = issue.fields.created;
        console.log(`Created Date: ${createdDate} - Due Date: ${dueDate}`);

        let isPlanned = false;
        const { hour, minute, amPm } = this.getTime(createdDate);
        if (dueDate) {
          if (createdDate.split('T')[0] === dueDate) {
            console.warn(
              `Issue created with same create/due date: ${createdDate} Due Date: ${dueDate}`,
            );

            if (
              (hour >= 12 && minute >= 0 && minute <= 59 && amPm === 'AM') ||
              (hour >= 1 && hour <= 10 && minute >= 0 && minute <= 59 && amPm === 'AM') ||
              (hour === 11 && minute <= 15 && amPm === 'AM')
            ) {
              isPlanned = true;
              createdDate = dueDate;
            } else if (
              (hour === 11 && minute >= 16 && minute <= 59 && amPm === 'AM') ||
              amPm === 'PM'
            ) {
              console.warn(`Unplanned issue found: ${createdDate} Due Date: ${dueDate}`);
              isPlanned = false;
              createdDate = createdDate.split('T')[0];
            } else {
              isPlanned = true;
              createdDate = createdDate.split('T')[0];
            }
          } else {
            console.warn(`Issue created earlier Created Date: ${createdDate} ,Due Date:${dueDate}`);
            isPlanned = true;
            createdDate = dueDate;
          }
        } else {
          isPlanned = true;
          createdDate = createdDate.split('T')[0];
        }
        const issueLinks = issue.fields?.issuelinks || [];
        const transformedIssueLinks = issueLinks.flatMap((link: any) => {
          const outwardId = link?.outwardIssue?.id || null;
          const inwardId = link?.inwardIssue?.id || null;
          return [outwardId, inwardId].filter(Boolean);
        });
        console.log(`Fetching data for accountId: ${issue.fields?.assignee?.accountId}`);

        console.log(`Created Date: ${new Date(issue.fields?.created.split('T')[0]).toISOString()}`);
        const transformedIssueLinksString = transformedIssueLinks.join(',');
        if (dueDate && issue.fields.assignee != null) {
          accountIds.add(issue.fields.assignee.accountId);
          return {
            issueType: issue.fields.issuetype.name,
            issueId: issue.id,
            issueSummary: issue.fields.summary,
            planned: isPlanned,
            issueStatus: issue.fields.status.name,
            issueIdUrl: issueIdUrl,
            link: transformedIssueLinksString,
            projectUrl: projectUrl,
            issueLinkUrl: projectUrl + '/browse/' + transformedIssueLinksString,
            accountId: issue.fields?.assignee?.accountId,
            date: new Date(createdDate).toISOString(),
            displayName: issue.fields?.assignee?.displayName,
            comment: '',
            organization: dataFetcherdto.organizationId,
          };
        }
      });
      console.log('DONE');
      return transformedIssue;
    } catch (error) {
      console.error('Error fetching issues from Jira', error.response?.data || error.message);
    }
  }

  async dataFetchFromTrello(dataFetcherDto: DataFetcherDTO) {
    try {
      console.log('Fetching data from....');
      console.log(dataFetcherDto.projectUrl);
      const API_KEY = this.configService.get('TRELLO_API_KEY');
      const TOKEN = this.configService.get('TRELLO_SECRET_KEY');
      const BASE_URL = 'https://api.trello.com/1';
      // const START_DATE = new Date(
      //   new Date().setDate(new Date().getDate() - 1),
      // ).toISOString();
      const START_DATE = dataFetcherDto.date;
      const TODAY = new Date().toISOString();
      const { data: boards } = await firstValueFrom(
        this.httpService.get(`${BASE_URL}/members/me/boards`, {
          params: { key: API_KEY, token: TOKEN, fields: 'id,name,url' },
        }),
      );

      let allCards = [];

      for (const board of boards) {
        // console.log(`${dataFetcherDto.projectUrl} - ${board.url}`);

        if (dataFetcherDto.projectUrl === board.url) {
          console.log(`📌 Fetching lists for board: ${board.name} (${board.id})`);
          const projectUrl = `trello.com/boards/${board.id}/lists`;
          const { data: lists } = await firstValueFrom(
            this.httpService.get(`${BASE_URL}/boards/${board.id}/lists`, {
              params: { key: API_KEY, token: TOKEN, fields: 'id,name' },
            }),
          );
          const listMap = lists.reduce((acc, list) => ((acc[list.id] = list.name), acc), {});

          console.log(`📌 Fetching cards from board: ${board.name} (${board.id})`);
          const { data: cards } = await firstValueFrom(
            this.httpService.get(`${BASE_URL}/boards/${board.id}/cards`, {
              params: {
                key: API_KEY,
                token: TOKEN,
                fields:
                  'id,name,dateLastActivity,desc,labels,idList,shortUrl,due,dateCreated,start,idMemberCreator',
                since: START_DATE,
                due: 'today',
              },
            }),
          );

          // Process cards and collect member IDs
          const processedCards = cards
            .filter((card) => new Date(card.dateLastActivity) <= new Date(TODAY))
            .map((card) => {
              const first8Hex = card.id.substr(0, 8);
              const epochDate = parseInt(first8Hex, 16);
              let dueDate = card.due;
              let createdDate = new Date(epochDate * 1000).toISOString();
              const { hour, minute, amPm } = this.getTime(createdDate);
              let isPlanned = true;
              if (dueDate) {
                if (createdDate.split('T')[0] === dueDate.split('T')[0]) {
                  console.warn(
                    `Issue created with same create/due date: ${createdDate} Due Date: ${dueDate}`,
                  );
                  if (
                    (hour >= 12 && minute >= 0 && minute <= 59 && amPm === 'AM') ||
                    (hour >= 1 && hour <= 10 && minute >= 0 && minute <= 59 && amPm === 'AM') ||
                    (hour === 11 && minute <= 15 && amPm === 'AM')
                  ) {
                    isPlanned = true;
                    createdDate = dueDate.split('T')[0];
                  } else if (
                    (hour === 11 && minute >= 16 && minute <= 59 && amPm === 'AM') ||
                    amPm === 'PM'
                  ) {
                    console.warn(`Unplanned issue found: ${createdDate} Due Date: ${dueDate}`);
                    isPlanned = false;
                    createdDate = createdDate.split('T')[0];
                  } else {
                    isPlanned = true;
                    createdDate = createdDate.split('T')[0];
                  }
                } else {
                  console.log(
                    `Issue created earlier Created Date: ${createdDate} ,Due Date:${dueDate}`,
                  );
                  isPlanned = true;
                  createdDate = dueDate.split('T')[0];
                }
              } else {
                isPlanned = true;
                createdDate = createdDate.split('T')[0];
              }
              let issueStatusModified = listMap[card.idList];
              if (issueStatusModified.toLowerCase() === 'done') {
                issueStatusModified = 'Done';
              } else if (issueStatusModified.toLowerCase() === 'in review') {
                issueStatusModified = 'In Review';
              }
              if (dueDate) {
                return {
                  issueId: card.id,
                  issueSummary: card.name,
                  issueStatus: issueStatusModified || 'Unknown',
                  issueType: 'Task',
                  issueIdUrl: card.shortUrl,
                  name: card.name,
                  planned: isPlanned,
                  projectUrl: projectUrl,
                  issueLinkUrl: '',
                  date: createdDate,
                  projectName: board.name,
                  accountId: card.idMemberCreator,
                  organization: dataFetcherDto.organizationId,
                };
              } else {
                console.log(`Found task without due date ${card.issueSummary}`);
              }
            });

          allCards.push(...processedCards);
        }
      }
      return allCards;
    } catch (error) {
      console.error(' Error fetching data from trello:', error.response?.data || error.message);
    }
  }

  async saveJiraIssueToIssueEntry(rawData: any) {
    console.log('INVOKED');

    const data = JSON.parse(rawData);

    for (let i = 0; i < data.length; i += 1) {
      if (!data[i]) continue;

      const {
        accountId,
        issueId,
        projectUrl,
        issueIdUrl,
        issueLinkUrl,
        issueType,
        issueStatus,
        issueSummary,
        planned,
        issueLinks,
        date,
        comment,
        organization,
      } = data[i];

      if (accountId) {
        // Fetch all users matching accountId or jiraId
        const users = await this.userModel.find({
          $or: [{ accountId }, { jiraId: accountId }],
        });
        // console.log(users);
        if (!users.length) {
          console.warn(`No users found for accountId: ${accountId}`);
          continue;
        }

        const issueDate = new Date(date);
        /// for handling corner case same user for multiple organization
        for (const user of users) {
          console.log(`Found user inserting issue for ${user.displayName} - Date: ${issueDate}...`);

          await this.issueEntryModel.findOneAndUpdate(
            {
              issueId, // Match by issueId
              projectUrl, // Match by projectUrl
              user: new mongoose.Types.ObjectId(user.id as string), // Ensure uniqueness per user
              organization: new mongoose.Types.ObjectId(organization as string), // Ensure uniqueness per organization
            },
            {
              serialNumber: i,
              issueId,
              issueType: issueType || '',
              issueStatus,
              issueSummary,
              username: user.displayName,
              planned,
              link: issueLinks || '',
              accountId,
              projectUrl,
              issueIdUrl,
              issueLinkUrl,
              user: new mongoose.Types.ObjectId(user.id as string), // Ensure uniqueness per user
              organization: new mongoose.Types.ObjectId(organization as string), // Ensure uniqueness per organization
              date: issueDate,
              comment: comment,
              issueCode: issueIdUrl.split('/').pop(), // Extract the issue code from the URL
            },
            {
              upsert: true, // Create if not found
              new: true, // Return the updated document
            },
          );
        }
      }
    }

    console.log('DONE..');
    return 'DONE';
  }

  async saveTrelloIssueToEntry(rawData: any) {
    console.log('INVOKED');

    const data = JSON.parse(rawData);
    console.log('Saving trello issues..');
    for (let i = 0; i < data.length; i += 1) {
      if (!data[i]) continue;
      const {
        accountId,
        issueId,
        projectUrl,
        issueIdUrl,
        issueLinkUrl,
        issueType,
        issueStatus,
        issueSummary,
        planned,
        issueLinks,
        date,
        comment,
        organization,
      } = data[i];
      console.log(accountId);
      if (accountId) {
        // Fetch all users matching accountId or jiraId
        const users = await this.userModel.find({
          $or: [{ accountId }, { trelloId: accountId }],
        });
        // console.log(users);
        if (!users.length) {
          console.warn(`No users found for accountId: ${accountId}`);
          continue;
        }
        let issueDate = new Date(date);
        if (issueDate.toString() === 'Invalid Date') {
          issueDate = new Date('2024-08-01');
        }

        /// for handling corner case same user for multiple organization
        for (const user of users) {
          console.log(`Found user inserting issue for ${user.displayName} - Date: ${issueDate}...`);

          await this.issueEntryModel.findOneAndUpdate(
            {
              issueId, // Match by issueId
              projectUrl, // Match by projectUrl
              user: new mongoose.Types.ObjectId(user.id as string), // Ensure uniqueness per user
              organization: new mongoose.Types.ObjectId(organization as string), // Ensure uniqueness per organization
            },
            {
              serialNumber: i,
              issueId,
              issueType: issueType || '',
              issueStatus,
              issueSummary,
              username: user.displayName,
              planned,
              link: '',
              accountId,
              projectUrl,
              issueIdUrl,
              issueLinkUrl: '',
              user: new mongoose.Types.ObjectId(user.id as string), // Ensure uniqueness per user
              organization: new mongoose.Types.ObjectId(organization as string), // Ensure uniqueness per organization
              date: issueDate,
              comment: comment,
              issueCode: issueIdUrl.split('/').pop(), // Extract the issue code from the URL
            },
            {
              upsert: true, // Create if not found
              new: true, // Return the updated document
            },
          );
        }
      } else {
        console.log(`No trello id matches id: ${accountId} `);
      }
    }

    console.log('DONE..');
    return 'DONE';
  }

  @Cron('0 * * * *', { timeZone: 'UTC' }) // Runs every hour at minute 0 (e.g., 1:00, 2:00, etc.) UTC
  async fetchDataFromAllToolUrls(verdict: boolean = false) {
    const tools = await this.toolModel
      .aggregate([
        {
          $lookup: {
            from: 'projects',
            localField: '_id',
            foreignField: 'tools',
            as: 'projects',
          },
        },
        {
          $unwind: {
            path: '$projects',
          },
        },
        {
          $addFields: {
            projects: '$projects._id',
          },
        },
        {
          $lookup: {
            from: 'organizationprojectusers',
            localField: 'projects',
            foreignField: 'project',
            as: 'opu',
          },
        },
        {
          $addFields: {
            // users: '$opu.user',
            organization: '$opu.organization',
          },
        },
        {
          $unwind: {
            path: '$organization',
          },
        },
        {
          $project: {
            toolUrl: 1,
            organization: 1,
          },
        },
      ])
      .exec();
    // const urls = tools.map((tool) => tool.toolUrl);
    const allDataJIRA = [];
    const allDataTrello = [];
    const toolSet = new Set();
    console.log(`Fetching data from jira...`);
    let newDate = new Date().toISOString().split('T')[0];

    if (verdict === true) {
      let lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7); // Subtract 7 days
      newDate = lastWeek.toISOString().split('T')[0]; // Format to YYYY-MM-DD
    }
    for (const tool of tools) {
      if (tool.toolUrl.search('atlassian') >= 0) {
        if (toolSet.has(tool)) {
          console.log(`Fetched from ${tool.toolUrl} earlier skiping.....`);
          continue;
        }
        toolSet.add(tool);

        try {
          console.log(`Fetching data from ${tool.toolUrl}`);

          const dataFetcherDto: DataFetcherDTO = {
            organizationId: tool.organization.toString(),
            projectUrl: tool.toolUrl,
            date: newDate,
          };

          const data = await this.dataFetchFromJIRA(dataFetcherDto);
          allDataJIRA.push(...data);
        } catch (error) {
          console.error(`Error fetching data from URL: ${tool.toolUrl}`, error);
        }
      }
    }

    const jiraStatus = await this.saveJiraIssueToIssueEntry(JSON.stringify(allDataJIRA));
    try {
      console.log(`Fetching data from trello...`);
      for (const tool of tools) {
        if (tool.toolUrl.search('trello') >= 0) {
          let trelloIssues = await this.dataFetchFromTrello({
            organizationId: tool.organization.toString(),
            projectUrl: tool.toolUrl,
            date: newDate,
          });
          if (trelloIssues.length > 0 || trelloIssues !== undefined || trelloIssues !== null) {
            allDataTrello.push(...trelloIssues);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching data from trello`);
    }

    const trelloStatus = await this.saveTrelloIssueToEntry(JSON.stringify(allDataTrello));

    let linearStatus = {};
    if (verdict === true) {
      console.log(`Fetching data from linear for last 7 days...`);
      // Parse and fetch for each day in the last 7 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const status = await this.linearService.fetchAndSaveIssuesFromLinear(dateStr);
        linearStatus[dateStr] = status;
      }
    } else {
      console.log(`Fetching data from linear for today...`);
      linearStatus = await this.linearService.fetchAndSaveIssuesFromLinear();
    }
    return {
      jiraStatus: jiraStatus,
      trelloStatus: trelloStatus,
      linearStatus: linearStatus,
    };
  }
}
