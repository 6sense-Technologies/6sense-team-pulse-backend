import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import {
  Designation,
  IIssue,
  Project,
  User,
} from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AxiosError } from 'axios';
import { TrelloErrorHelper } from 'src/common/helpers/trello-error.helper';

dotenv.config();

@Injectable()
export class TrelloService {
  private readonly trelloBaseUrl = 'https://api.trello.com/1';
  private readonly boardIds: string[] = [
    process.env.TRELLO_BOARD_ID_1,
    process.env.TRELLO_BOARD_ID_2,
  ];

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    // Constructor for injecting userModel
  }

  private async fetchFromBothBoards(endpoint: string) {
    try {
      const requests = this.boardIds.map((boardId) =>
        this.httpService
          .get(`${this.trelloBaseUrl}${endpoint}`, {
            params: {
              key: process.env.TRELLO_API_KEY,
              token: process.env.TRELLO_SECRET_KEY,
            },
          })
          .toPromise(),
      );

      const responses = await Promise.all(requests);
      return responses.map((response) => response.data);
    } catch (error) {
      TrelloErrorHelper.getInstance().handleTrelloApiError(error);
    }
  }

  async getBoards() {
    try {
      const endpoint = `/members/me/boards`;

      const response = await this.httpService
        .get(`${this.trelloBaseUrl}${endpoint}`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: process.env.TRELLO_SECRET_KEY,
          },
        })
        .toPromise();

      const boards = response.data.map((board: any) => ({
        id: board.id,
        name: board.name,
      }));

      return boards;
    } catch (error) {
      TrelloErrorHelper.getInstance().handleTrelloApiError(error);
    }
  }

  async getMembers() {
    try {
      const boardDetails = await this.getBoards();
      const endpoint = `/boards/{boardId}/members`;

      const requests = this.boardIds.map((boardId) =>
        this.httpService
          .get(
            `${this.trelloBaseUrl}${endpoint.replace('{boardId}', boardId)}`,
            {
              params: {
                key: process.env.TRELLO_API_KEY,
                token: process.env.TRELLO_SECRET_KEYs,
              },
            },
          )
          .toPromise()
          .then((response) => ({
            boardId,
            boardName: boardDetails.find((board) => board.id === boardId)?.name,
            members: response.data,
          })),
      );

      const responses = await Promise.all(requests);

      const members = responses.flatMap(({ boardId, boardName, members }) => {
        return members.map((member) => ({
          ...member,
          boardId,
          boardName: boardName,
        }));
      });

      return members;
    } catch (error) {
      TrelloErrorHelper.getInstance().handleTrelloApiError(error);
    }
  }

  async getMemberDetails(accountId: string) {
    try {
      const endpoint = `/members/${accountId}`;

      const memberData = await this.fetchFromBothBoards(endpoint);
      return memberData;
    } catch (error) {
      throw error;
    }
  }

  async getUserCards(accountId: string): Promise<any[]> {
    const boardsEndpoint = `/members/${accountId}/boards`;

    try {
      // Fetch boards
      const boardsResponse = await this.httpService
        .get(`${this.trelloBaseUrl}${boardsEndpoint}`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: process.env.TRELLO_SECRET_KEY,
          },
        })
        .toPromise();

      const boardsData = boardsResponse.data;

      if (!boardsData || boardsData.length === 0) {
        throw new InternalServerErrorException(
          'No boards found for this member.',
        );
      }

      const cardPromises = boardsData.map(async (board) => {
        const listsEndpoint = `/boards/${board.id}/lists`;

        // Fetch lists for the board
        const listsResponse = await this.httpService
          .get(`${this.trelloBaseUrl}${listsEndpoint}`, {
            params: {
              key: process.env.TRELLO_API_KEY,
              token: process.env.TRELLO_SECRET_KEY,
            },
          })
          .toPromise();

        const listsData = listsResponse.data;

        // Get today's date in 'YYYY-MM-DD' format
        const day = new Date();
        day.setDate(day.getDate() - 2);
        const today = day.toISOString().split('T')[0];

        // Map through lists to get cards for each list
        const cardPromises = listsData.map(async (list) => {
          const cardsEndpoint = `/lists/${list.id}/cards`;

          const cardsResponse = await this.httpService
            .get(`${this.trelloBaseUrl}${cardsEndpoint}`, {
              params: {
                key: process.env.TRELLO_API_KEY,
                token: process.env.TRELLO_SECRET_KEY,
              },
            })
            .toPromise();

          // Filter cards to get only those belonging to the specified user and with today's due date
          return cardsResponse.data
            .filter(
              (card) =>
                card.idMembers.includes(accountId) &&
                card.due &&
                card.due.split('T')[0] === today,
            ) // Check if the due date is today
            .map((card) => ({
              cardId: card.id,
              cardName: card.name,
              listName: list.name, // Include the name of the list
              dueDate: card.due.split('T')[0], // Include due date, default to null if not set
            }));
        });

        // Wait for all card promises and flatten the result
        const cards = await Promise.all(cardPromises);
        return cards.flat();
      });

      // Wait for all board promises and flatten the result
      const allCards = await Promise.all(cardPromises);
      return allCards.flat();
    } catch (error) {
      console.error(
        'Error fetching user cards:',
        error.response ? error.response.data : error.message,
      );
      throw new InternalServerErrorException(
        'Error fetching user cards from Trello',
      );
    }
  }

  async saveUser(
    accountId: string,
    userFrom: string,
    userData: any,
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

      const userToSave = {
        accountId: userData.id,
        displayName: userData.fullName,
        designation,
        project,
        userFrom,
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
    userFrom: string,
    designation: Designation,
    project: Project,
  ): Promise<{ statusCode: number; message: string; user?: User }> {
    try {
      const memberDetails = await this.getMemberDetails(accountId);

      // If getMemberDetails returns an array, pick the first element
      const userDetails = Array.isArray(memberDetails)
        ? memberDetails[0]
        : memberDetails;

      const saveResponse = await this.saveUser(
        accountId,
        userFrom,
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
      console.error('Error fetching and saving user:', error);
      throw error;
    }
  }

  async countNotDoneIssuesForToday(accountId: string): Promise<void> {
    // const today = new Date().toLocaleDateString('en-CA', {
    //   timeZone: 'Asia/Dhaka',
    // });

    const today = new Date(
      new Date().setDate(new Date().getDate() - 2),
    ).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });

    // Assuming a function exists to get user cards from Trello
    const userCards = await this.getUserCards(accountId); // This function should fetch Trello cards for the user

    // Prepare counts and issues storage
    const countsByDate: {
      [key: string]: { Task: number; Bug: number; Story: number };
    } = {};
    const issuesByDate: { [key: string]: IIssue[] } = {};

    // Filter cards for not done issues
    const notDoneIssues = userCards.filter(
      (card) =>
        card.listName !== 'Done' && card.dueDate?.split('T')[0] === today,
    );

    if (notDoneIssues.length === 0) {
      // If no issues found, save with zero counts
      await this.saveNotDoneIssueCounts(
        accountId,
        today,
        { Task: 0, Bug: 0, Story: 0 },
        [],
      );
      return; // Exit early if there are no issues
    }

    notDoneIssues.forEach((card) => {
      const dueDate = card.dueDate.split('T')[0]; // Extract the due date
      const issueId = card.cardId; // cardId
      const summary = card.cardName; // cardName
      const status = card.listName; // listName
      let issueType = 'Task'; // Default to Task

      // Determine the issue type based on list name
      if (card.listName === 'Bug') {
        issueType = 'Bug';
      } else if (card.listName === 'User Stories') {
        issueType = 'Story';
      } else if (
        ['To do', 'Work In Progress', 'Unit Testing', 'In Testing'].includes(
          card.listName,
        )
      ) {
        issueType = 'Task'; // Other lists will be treated as Tasks
      }

      // Initialize the date entry if it doesn't exist
      if (!countsByDate[dueDate]) {
        countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
        issuesByDate[dueDate] = [];
      }

      // Increment the appropriate counts
      if (issueType === 'Task') {
        countsByDate[dueDate].Task++;
      } else if (issueType === 'Bug') {
        countsByDate[dueDate].Bug++;
      } else if (issueType === 'Story') {
        countsByDate[dueDate].Story++;
      }

      // Push the issue into the issuesByDate array
      issuesByDate[dueDate].push({
        issueId,
        summary,
        status,
        issueType,
        dueDate,
      });
    });

    // Save the counts and issues for today
    for (const [date, counts] of Object.entries(countsByDate)) {
      await this.saveNotDoneIssueCounts(
        accountId,
        date,
        counts,
        issuesByDate[date],
      );
    }
  }

  async saveNotDoneIssueCounts(
    accountId: string,
    date: string,
    counts: { Task: number; Bug: number; Story: number },
    issues: IIssue[],
  ): Promise<void> {
    try {
      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      // Update user's issue history
      const existingHistory = user.issueHistory.find((history) => {
        return history.date === date;
      });

      if (existingHistory) {
        existingHistory.issuesCount.notDone = counts; // Update counts
        existingHistory.notDoneIssues = issues; // Update issues
      } else {
        user.issueHistory.push({
          date,
          issuesCount: { notDone: counts }, // New entry for counts
          notDoneIssues: issues, // New entry for issues
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error saving not-done issue counts',
      );
    }
  }

  async countDoneIssuesForToday(accountId: string): Promise<void> {
    // const today = new Date().toLocaleDateString('en-CA', {
    //   timeZone: 'Asia/Dhaka',
    // });

    const today = new Date(
      new Date().setDate(new Date().getDate() - 2),
    ).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Dhaka',
    });

    // Assuming a function exists to get user cards from Trello
    const userCards = await this.getUserCards(accountId);

    // Fetch the user from the database
    const user = await this.userModel.findOne({ accountId }).exec();
    const notDoneIssues =
      user?.issueHistory.find((entry) => entry.date === today)?.notDoneIssues ||
      []; // Access not done issues for today

    // Prepare counts and issues storage
    const countsByDate: {
      [key: string]: { Task: number; Bug: number; Story: number };
    } = {};
    const issuesByDate: { [key: string]: IIssue[] } = {};

    // Now loop through all user cards to store all issues and count done ones
    userCards.forEach((card) => {
      const dueDate = card.dueDate.split('T')[0]; // Extract the due date
      const issueId = card.cardId; // cardId from the user cards
      const summary = card.name; // cardName
      const status = card.listName; // listName

      // Initialize the date entry if it doesn't exist
      if (!countsByDate[dueDate]) {
        countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
        issuesByDate[dueDate] = [];
      }

      // Push the issue into the issuesByDate array (store all issues)
      issuesByDate[dueDate].push({
        issueId,
        summary,
        status,
        dueDate,
      });

      // Only process cards in the "Done" list for counting
      if (card.listName === 'Done') {
        // Try to find the matching issue in the not done issues array by issueId
        const matchingNotDoneIssue = notDoneIssues.find(
          (notDoneIssue) => notDoneIssue.issueId === card.cardId, // Match based on issueId
        );

        // If found, count according to the issueType of the matched not done issue
        if (matchingNotDoneIssue) {
          if (matchingNotDoneIssue.issueType === 'Bug') {
            countsByDate[dueDate].Bug++; // Increment Bug count
          } else if (matchingNotDoneIssue.issueType === 'Story') {
            countsByDate[dueDate].Story++; // Increment Story count
          } else {
            countsByDate[dueDate].Task++; // Increment Task count for all other cases
          }
        } else {
          // If no match is found, count as a Task
          countsByDate[dueDate].Task++;
        }
      }
    });

    // Save the counts and issues for today
    for (const [date, counts] of Object.entries(countsByDate)) {
      await this.saveDoneIssueCounts(
        accountId,
        date,
        counts,
        issuesByDate[date],
      );
    }
  }

  async saveDoneIssueCounts(
    accountId: string,
    date: string,
    counts: { Task: number; Bug: number; Story: number },
    issues: IIssue[],
  ): Promise<void> {
    try {
      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      // Update user's issue history
      const existingHistory = user.issueHistory.find((history) => {
        return history.date === date;
      });

      if (existingHistory) {
        existingHistory.issuesCount.done = counts; // Update counts for done issues
        existingHistory.doneIssues = issues; // Update done issues
      } else {
        user.issueHistory.push({
          date,
          issuesCount: { done: counts }, // New entry for done issue counts
          doneIssues: issues, // New entry for done issues
        });
      }

      await user.save();
    } catch (error) {
      throw new InternalServerErrorException('Error saving done issue counts');
    }
  }
}
