import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import { ITrelloBoard, ITrelloUsers } from './interfaces/trello.interfaces';
import { firstValueFrom } from 'rxjs';
import { handleError } from '../../common/helpers/error.helper';
import {
  validateAccountId,
  validateDate,
} from '../../common/helpers/validation.helper';
import { UserService } from '../users/users.service';

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
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    // Constructor for injecting userModel
  }

  async getBoards(): Promise<ITrelloBoard[]> {
    try {
      const endpoint = `/members/me/boards`;

      const response = await firstValueFrom(
        this.httpService.get(`${this.trelloBaseUrl}${endpoint}`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: process.env.TRELLO_SECRET_KEY,
          },
        }),
      );

      const boards = response.data.map(
        (board: { id: string; name: string }) => ({
          id: board.id,
          name: board.name,
        }),
      );

      return boards;
    } catch (error) {
      handleError(error);
    }
  }

  async getUsers(): Promise<ITrelloUsers[]> {
    try {
      const boardDetails = await this.getBoards();
      const endpoint = `/boards/{boardId}/members`;

      // Create an array of promises for the API calls
      const requests = this.boardIds.map((boardId) =>
        firstValueFrom(
          this.httpService.get(
            `${this.trelloBaseUrl}${endpoint.replace('{boardId}', boardId)}`,
            {
              params: {
                key: process.env.TRELLO_API_KEY,
                token: process.env.TRELLO_SECRET_KEY,
              },
            },
          ),
        ).then((response) => ({
          boardId,
          boardName: boardDetails.find((board) => {
            return board.id === boardId;
          })?.name,
          users: response.data,
        })),
      );

      // Wait for all requests to complete
      const responses = await Promise.all(requests);

      // Flatten the users array and enrich it with board information
      const users = responses.flatMap(({ boardId, boardName, users }) =>
        users.map((user) => ({
          ...user,
          boardId,
          boardName: boardName,
        })),
      );

      return users;
    } catch (error) {
      handleError(error);
    }
  }

  async getUserDetails(accountId: string): Promise<any> {
    try {
      const endpoint = `/members/${accountId}`;

      const response = await firstValueFrom(
        this.httpService.get(`${this.trelloBaseUrl}${endpoint}`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: process.env.TRELLO_SECRET_KEY,
          },
        }),
      );

      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async getUserIssues(accountId: string, date: string): Promise<any[]> {
    try {
      const boardsEndpoint = `/members/${accountId}/boards`;

      // Step 1: Fetch boards for the user
      const boardsResponse = await firstValueFrom(
        this.httpService.get(`${this.trelloBaseUrl}${boardsEndpoint}`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: process.env.TRELLO_SECRET_KEY,
          },
        }),
      );

      const boards = boardsResponse.data;

      // Step 2: Format the date to check for cards
      const dateString = new Date(date).toISOString().split('T')[0];

      // Function to fetch cards for a specific board
      const fetchCardsForBoard = async (boardId: string, boardName: string) => {
        // Fetch lists for the board
        const listsResponse = await firstValueFrom(
          this.httpService.get(
            `${this.trelloBaseUrl}/boards/${boardId}/lists`,
            {
              params: {
                key: process.env.TRELLO_API_KEY,
                token: process.env.TRELLO_SECRET_KEY,
              },
            },
          ),
        );

        const lists = listsResponse.data;

        // Step 3: Fetch cards for each list in the board
        const cards = await Promise.all(
          lists.map(async (list) => {
            // Fetch cards for the current list
            const cardsResponse = await firstValueFrom(
              this.httpService.get(
                `${this.trelloBaseUrl}/lists/${list.id}/cards`,
                {
                  params: {
                    key: process.env.TRELLO_API_KEY,
                    token: process.env.TRELLO_SECRET_KEY,
                  },
                },
              ),
            );

            // Filter cards that belong to the user and are due on the specified date
            return cardsResponse.data
              .filter(
                (card) =>
                  card.idMembers.includes(accountId) &&
                  card.due?.split('T')[0] === dateString,
              )
              .map((card) => ({
                cardId: card.id,
                cardName: card.name,
                listName: list.name,
                boardName: boardName,
                dueDate: card.due.split('T')[0],
              }));
          }),
        );

        return cards.flat();
      };

      // Step 4: Fetch cards for all boards
      const allCards = await Promise.all(
        boards.map((board) => {
          return fetchCardsForBoard(board.id, board.name);
        }),
      );

      return allCards.flat();
    } catch (error) {
      handleError(error);
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

      const memberDetails = await this.getUserDetails(accountId);

      const userToSave = {
        accountId: memberDetails.id,
        displayName: memberDetails.fullName,
        designation,
        project,
        userFrom,
      };

      const existingUser = await this.userModel.findOne({ accountId });
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const newUser = new this.userModel(userToSave);
      await newUser.save();

      return {
        message: 'User saved successfully',
        statusCode: 201,
        user: newUser,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async countPlannedIssues(accountId: string, date: string): Promise<void> {
    try {
      validateAccountId(accountId);
      validateDate(date);
      const dateString = new Date(date).toISOString().split('T')[0];

      // Fetch user cards
      const userCards = await this.getUserIssues(accountId, date);

      // Prepare storage for counts and issues
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

      // Step 1: Filter out not done issues that are due on the specified date
      const notDoneIssues = userCards.filter((card) => {
        return (
          card.listName !== 'Done' && card.dueDate?.split('T')[0] === dateString
        );
      });

      // If no issues are found, save zero counts and exit
      const user = await this.userModel.findOne({ accountId });

      if (notDoneIssues.length === 0) {
        const existingHistory = user.issueHistory.find((history) => {
          return history.date === dateString;
        });
        if (existingHistory) {
          existingHistory.issuesCount.notDone = { Task: 0, Bug: 0, Story: 0 };
          existingHistory.notDoneIssues = [];
        } else {
          user.issueHistory.push({
            date: dateString,
            issuesCount: { notDone: { Task: 0, Bug: 0, Story: 0 } },
            notDoneIssues: [],
          });
        }
        await user.save();
        return;
      }

      // Step 2: Process each not done issue
      notDoneIssues.forEach((card) => {
        const dueDate = card.dueDate.split('T')[0];
        const issueId = card.cardId;
        const summary = card.cardName;
        const status = card.listName;

        // Determine the issue type based on the list name
        let issueType: 'Task' | 'Bug' | 'Story' = 'Task';
        if (card.listName === 'Bug') {
          issueType = 'Bug';
        } else if (card.listName === 'User Stories') {
          issueType = 'Story';
        }

        // Initialize counts if the date entry does not exist
        if (!countsByDate[dueDate]) {
          countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
          issuesByDate[dueDate] = [];
        }

        // Increment the count for the issue type
        countsByDate[dueDate][issueType]++;

        // Add the issue to the issuesByDate array
        issuesByDate[dueDate].push({
          issueId,
          summary,
          status,
          issueType,
          dueDate,
        });
      });

      // Step 3: Save the counts and issues for the specified date
      for (const date in countsByDate) {
        const existingHistory = user.issueHistory.find((history) => {
          return history.date === date;
        });

        if (existingHistory) {
          existingHistory.issuesCount.notDone = countsByDate[date];
          existingHistory.notDoneIssues = issuesByDate[date];
        } else {
          user.issueHistory.push({
            date,
            issuesCount: { notDone: countsByDate[date] },
            notDoneIssues: issuesByDate[date],
          });
        }
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
      const userCards = await this.getUserIssues(accountId, date);
      const user = await this.userModel.findOne({ accountId }).exec();
      const dateString = new Date(date).toISOString().split('T')[0];

      // Get not done issues for the provided date from the user's issue history
      const notDoneIssues =
        user?.issueHistory.find((entry) => {
          return entry.date === dateString;
        })?.notDoneIssues || [];

      // Prepare storage for counts and issues
      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

      // Step 2: Loop through all user cards to count done issues
      userCards.forEach((card) => {
        const dueDate = card.dueDate.split('T')[0];
        const issueId = card.cardId;
        const summary = card.name;
        const status = card.listName;

        // Initialize the date entry if it doesn't exist
        if (!countsByDate[dueDate]) {
          countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
          issuesByDate[dueDate] = [];
        }

        // Store the issue in the issuesByDate array
        issuesByDate[dueDate].push({
          issueId,
          summary,
          status,
          dueDate,
        });

        // Step 3: Only process cards in the "Done" list for counting
        if (card.listName === 'Done') {
          // Try to find the matching not done issue by issueId
          const matchingNotDoneIssue = notDoneIssues.find((notDoneIssue) => {
            return notDoneIssue.issueId === card.cardId;
          });

          if (matchingNotDoneIssue) {
            if (matchingNotDoneIssue.issueType === 'Bug') {
              countsByDate[dueDate].Bug++;
            } else if (matchingNotDoneIssue.issueType === 'Story') {
              countsByDate[dueDate].Story++;
            } else {
              countsByDate[dueDate].Task++;
            }
          } else {
            countsByDate[dueDate].Task++;
          }
        }
      });

      const existingHistory = user.issueHistory.find(
        (history) => history.date === dateString,
      );
      if (existingHistory) {
        existingHistory.issuesCount.done = countsByDate[dateString] || {
          Task: 0,
          Bug: 0,
          Story: 0,
        };
        existingHistory.doneIssues = issuesByDate[dateString] || [];
      } else {
        user.issueHistory.push({
          date: dateString,
          issuesCount: {
            done: countsByDate[dateString] || { Task: 0, Bug: 0, Story: 0 },
          },
          doneIssues: issuesByDate[dateString] || [],
        });
      }

      await user.save();

      await this.userService.fetchAndSaveAllIssues(accountId, date);
    } catch (error) {
      handleError(error);
    }
  }

  // async countPlannedIssues(accountId: string, date: string): Promise<void> {
  //   try {
  //     validateAccountId(accountId);
  //     validateDate(date);
  //     const dateString = new Date(date).toISOString().split('T')[0];

  //     // Fetch user cards
  //     const userCards = await this.getUserIssues(accountId,date);

  //     // Prepare storage for counts and issues
  //     const countsByDate: {
  //       [key: string]: { Task: number; Bug: number; Story: number };
  //     } = {};
  //     const issuesByDate: { [key: string]: IIssue[] } = {};

  //     // Step 1: Filter out not done issues that are due on the specified date
  //     const notDoneIssues = userCards.filter((card) => {
  //       return (
  //         card.listName !== 'Done' && card.dueDate?.split('T')[0] === dateString
  //       );
  //     });

  //     // If no issues are found, save zero counts and exit
  //     if (notDoneIssues.length === 0) {
  //       await this.savePlannedIssueCounts(
  //         accountId,
  //         dateString,
  //         { Task: 0, Bug: 0, Story: 0 },
  //         [],
  //       );
  //       return;
  //     }

  //     // Step 2: Process each not done issue
  //     notDoneIssues.forEach((card) => {
  //       const dueDate = card.dueDate.split('T')[0];
  //       const issueId = card.cardId;
  //       const summary = card.cardName;
  //       const status = card.listName;

  //       // Determine the issue type based on the list name
  //       let issueType: 'Task' | 'Bug' | 'Story' = 'Task';
  //       if (card.listName === 'Bug') {
  //         issueType = 'Bug';
  //       } else if (card.listName === 'User Stories') {
  //         issueType = 'Story';
  //       }

  //       // Initialize counts if the date entry does not exist
  //       if (!countsByDate[dueDate]) {
  //         countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
  //         issuesByDate[dueDate] = [];
  //       }

  //       // Increment the count for the issue type
  //       countsByDate[dueDate][issueType]++;

  //       // Add the issue to the issuesByDate array
  //       issuesByDate[dueDate].push({
  //         issueId,
  //         summary,
  //         status,
  //         issueType,
  //         dueDate,
  //       });
  //     });

  //     // Step 3: Save the counts and issues for the specified date
  //     for (const date in countsByDate) {
  //       await this.savePlannedIssueCounts(
  //         accountId,
  //         date,
  //         countsByDate[date],
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
  //     validateAccountId(accountId);
  //     validateDate(date);
  //     const user = await this.userModel.findOne({ accountId });

  //     if (!user) {
  //       throw new NotFoundException('User not found');
  //     }

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

  //   async countDoneIssues(accountId: string, date: string): Promise<void> {
  //     try {
  //       validateAccountId(accountId);
  //       validateDate(date);
  //       const userCards = await this.getUserIssues(accountId,date);
  //       const user = await this.userModel.findOne({ accountId }).exec();
  //       const dateString = new Date(date).toISOString().split('T')[0];

  //       // Get not done issues for the provided date from the user's issue history
  //       const notDoneIssues =
  //         user?.issueHistory.find((entry) => {
  //           return entry.date === dateString;
  //         })?.notDoneIssues || [];

  //       // Prepare storage for counts and issues
  //       const countsByDate: {
  //         [key: string]: { Task: number; Bug: number; Story: number };
  //       } = {};
  //       const issuesByDate: { [key: string]: IIssue[] } = {};

  //       // Step 2: Loop through all user cards to count done issues
  //       userCards.forEach((card) => {
  //         const dueDate = card.dueDate.split('T')[0];
  //         const issueId = card.cardId;
  //         const summary = card.name;
  //         const status = card.listName;

  //         // Initialize the date entry if it doesn't exist
  //         if (!countsByDate[dueDate]) {
  //           countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
  //           issuesByDate[dueDate] = [];
  //         }

  //         // Store the issue in the issuesByDate array
  //         issuesByDate[dueDate].push({
  //           issueId,
  //           summary,
  //           status,
  //           dueDate,
  //         });

  //         // Step 3: Only process cards in the "Done" list for counting
  //         if (card.listName === 'Done') {
  //           // Try to find the matching not done issue by issueId
  //           const matchingNotDoneIssue = notDoneIssues.find((notDoneIssue) => {
  //             return notDoneIssue.issueId === card.cardId;
  //           });

  //           if (matchingNotDoneIssue) {
  //             if (matchingNotDoneIssue.issueType === 'Bug') {
  //               countsByDate[dueDate].Bug++;
  //             } else if (matchingNotDoneIssue.issueType === 'Story') {
  //               countsByDate[dueDate].Story++;
  //             } else {
  //               countsByDate[dueDate].Task++;
  //             }
  //           } else {
  //             countsByDate[dueDate].Task++;
  //           }
  //         }
  //       });

  //       // Step 4: Save the counts and issues for the specified date
  //       await this.saveDoneIssueCounts(
  //         accountId,
  //         dateString,
  //         countsByDate[dateString] || { Task: 0, Bug: 0, Story: 0 },
  //         issuesByDate[dateString] || [],
  //       );
  //     } catch (error) {
  //       handleError(error);
  //     }
  //   }

  //   async saveDoneIssueCounts(
  //     accountId: string,
  //     date: string,
  //     counts: { Task: number; Bug: number; Story: number },
  //     issues: IIssue[],
  //   ): Promise<void> {
  //     try {
  //       validateAccountId(accountId);
  //       validateDate(date);
  //       const user = await this.userModel.findOne({ accountId });

  //       if (!user) {
  //         throw new NotFoundException('User not found');
  //       }

  //       const existingHistory = user.issueHistory.find((history) => {
  //         return history.date === date;
  //       });

  //       if (existingHistory) {
  //         existingHistory.issuesCount.done = counts;
  //         existingHistory.doneIssues = issues;
  //       } else {
  //         user.issueHistory.push({
  //           date,
  //           issuesCount: { done: counts },
  //           doneIssues: issues,
  //         });
  //       }

  //       await user.save();
  //     } catch (error) {
  //       handleError(error);
  //     }
  //   }
}
