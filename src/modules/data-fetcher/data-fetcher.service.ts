import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
// import { EnvironmentVariables } from 'src/interfaces/config';
import { DataFetcherDTO } from './dto/data-fetcher.dto';
import { Tool } from '../users/schemas/Tool.schema';
import mongoose, { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { JiraService } from '../jira/jira.service';
import { IssueEntry } from '../users/schemas/IssueEntry.schema';
import { Users } from '../users/schemas/users.schema';
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
  ) {}
  getWeekendsInRange(startDate: string, endDate: string) {
    let weekends = [];

    let start = new Date(startDate); // Start date
    let end = new Date(endDate); // End date

    // Create a formatter for Bangladeshi time
    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Dhaka',
    });

    while (start <= end) {
      let day = start.getDay(); // 0 = Sunday, 6 = Saturday
      let isoString = start.toISOString(); // Get ISO string format

      if (day === 6) {
        // Saturday
        weekends.push(isoString);
      } else if (day === 0) {
        // Sunday
        weekends.push(isoString);
      }

      start.setDate(start.getDate() + 1); // Move to the next day
    }

    return weekends;
  }
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
      Authorization: `Basic ${Buffer.from(
        `${emailAddress}:${accessToken}`,
      ).toString('base64')}`,
      Accept: 'application/json',
    };
    const todaysDate =
      dataFetcherdto.date || new Date().toISOString().split('T')[0];
    console.log(`Fetching datas for date: ${todaysDate}`);
    // const tempDate = '2024-08-01';
    const jqlQuery = {
      jql: `created >= '${todaysDate}'`,
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
              (hour >= 1 &&
                minute >= 0 &&
                hour <= 11 &&
                minute <= 15 &&
                amPm === 'AM')
            ) {
              isPlanned = true;
              createdDate = dueDate;
            } else if (
              (hour >= 11 && minute >= 16 && minute <= 59 && amPm === 'AM') ||
              amPm === 'PM'
            ) {
              console.warn(
                `Unplanned issue found: ${createdDate} Due Date: ${dueDate}`,
              );
              isPlanned = false;
              createdDate = createdDate.split('T')[0];
            } else {
              isPlanned = true;
              createdDate = createdDate.split('T')[0];
            }
          } else {
            console.warn(
              `Issue created earlier Created Date: ${createdDate} ,Due Date:${dueDate}`,
            );
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
        console.log(
          `Fetching data for accountId: ${issue.fields?.assignee?.accountId}`,
        );

        console.log(
          `Created Date: ${new Date(issue.fields?.created.split('T')[0]).toISOString()}`,
        );
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
          };
        }
      });
      console.log('DONE');
      const weekDays = this.getWeekendsInRange(
        todaysDate,
        new Date().toISOString().split('T')[0],
      );
      console.log(weekDays);
      if (accountIds) {
        for (const accountId of accountIds) {
          for (let i = 0; i < weekDays.length; i += 1) {
            if (accountId) {
              console.table(
                `Inserting data for weekDays ${weekDays[i]} for user ${accountId}`,
              );
              transformedIssue.push({
                issueType: 'Holiday',
                issueId: `DUMMY-${weekDays[i]}-${accountId}`,
                issueSummary: 'DUMMY',
                planned: false,
                issueStatus: 'DONE',
                issueIdUrl: 'http://0.0.0.0',
                link: 'http://0.0.0.0',
                projectUrl: 'http://0.0.0.0',
                issueLinkUrl: 'http://0.0.0.0',
                accountId: accountId,
                date: new Date(weekDays[i]).toISOString(),
                displayName: 'N/A',
                comment: 'holidays/leave',
              });
            }
          }
        }
      }
      return transformedIssue;
    } catch (error) {
      console.error(
        'Error fetching issues from Jira',
        error.response?.data || error.message,
      );
    }
  }
  async saveJiraIssueToIssueEntry(rawData: any) {
    console.log('INVOKED');

    const data = JSON.parse(rawData);
    // console.log(data);

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
          console.log(
            `Found user inserting issue for ${user.displayName} - Date: ${issueDate}...`,
          );

          await this.issueEntryModel.findOneAndUpdate(
            {
              issueId, // Match by issueId
              projectUrl, // Match by projectUrl
              user: new mongoose.Types.ObjectId(user.id), // Ensure uniqueness per user
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
              user: new mongoose.Types.ObjectId(user.id),
              date: issueDate,
              comment: comment,
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
  async fetchDataFromAllToolUrls() {
    const tools = await this.toolModel.find({});
    const urls = tools.map((tool) => tool.toolUrl);
    const allData = [];
    const urlSet = new Set();
    for (const url of urls) {
      if (url.search('atlassian') >= 0) {
        if (urlSet.has(url)) {
          console.log(`Fetched from ${url} earlier skiping.....`);
          continue;
        }
        urlSet.add(url);

        try {
          const dataFetcherDto: DataFetcherDTO = {
            projectUrl: url,
            date: new Date().toISOString().split('T')[0],
          };

          const data = await this.dataFetchFromJIRA(dataFetcherDto);
          allData.push(...data);
        } catch (error) {
          console.error(`Error fetching data from URL: ${url}`, error);
          // throw error; // Uncomment this line if you want to stop the process on error
        }
      } else {
        console.log('Not a valid jira board url');
      }
    }
    const status = await this.saveJiraIssueToIssueEntry(
      JSON.stringify(allData),
    );
    return status;
  }
}
