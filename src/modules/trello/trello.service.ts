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
import {
  ITrelloBoard,
  ITrelloCard,
  ITrelloUsers,
} from './interfaces/trello.interfaces';
import { firstValueFrom } from 'rxjs';
import { handleError } from '../../common/helpers/error.helper';
import {
  validateAccountId,
  validateDate,
} from '../../common/helpers/validation.helper';
import { UserService } from '../users/users.service';
import { ISuccessResponse } from 'src/common/interfaces/jira.interfaces';

dotenv.config();

@Injectable()
export class TrelloService {
  private readonly trelloBaseUrl = 'https://api.trello.com/1';
  private readonly boardIds: string[] = [
    process.env.TRELLO_BOARD_ID_1,
    process.env.TRELLO_BOARD_ID_2,
    process.env.TRELLO_BOARD_ID_3,
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    // Constructor for injecting userModel
  }

  // First, try the credentials of workspace 1
  private getWorkspace1Credentials() {
    return {
      key: process.env.TRELLO_API_KEY,
      token: process.env.TRELLO_SECRET_KEY,
    };
  }

  // Fallback: try the credentials of workspace 2
  private getWorkspace2Credentials() {
    return {
      key: process.env.TRELLO_API_KEY2,
      token: process.env.TRELLO_SECRET_KEY2,
    };
  }

  private async fetchBoards(credentials: {
    key: string;
    token: string;
  }): Promise<ITrelloBoard[]> {
    const endpoint = `/members/me/boards`;

    const response = await firstValueFrom(
      this.httpService.get(`${this.trelloBaseUrl}${endpoint}`, {
        params: {
          key: credentials.key,
          token: credentials.token,
        },
      }),
    );

    return response.data.map((board: { id: string; name: string }) => ({
      id: board.id,
      name: board.name,
    }));
  }

  async getBoards(): Promise<ITrelloBoard[]> {
    const credentials1 = this.getWorkspace1Credentials();
    const credentials2 = this.getWorkspace2Credentials();

    const results = await Promise.allSettled([
      this.fetchBoards(credentials1),
      this.fetchBoards(credentials2),
    ]);

    const boards = results
      .filter((result) => result.status === 'fulfilled')
      .flatMap(
        (result) => (result as PromiseFulfilledResult<ITrelloBoard[]>).value,
      );

    return boards;
  }

  async getUsers(): Promise<ITrelloUsers[]> {
    try {
      const boardDetails = await this.getBoards();
      const endpoint = `/boards/{boardId}/members`;

      // Create an array of promises for the API calls
      const requests = this.boardIds.map((boardId) => {
        // Determine which workspace the board belongs to
        const isWorkspace1Board =
          boardId === process.env.TRELLO_BOARD_ID_1 ||
          boardId === process.env.TRELLO_BOARD_ID_2;
        const credentials = isWorkspace1Board
          ? this.getWorkspace1Credentials()
          : this.getWorkspace2Credentials();

        return firstValueFrom(
          this.httpService.get(
            `${this.trelloBaseUrl}${endpoint.replace('{boardId}', boardId)}`,
            {
              params: {
                key: credentials.key,
                token: credentials.token,
              },
            },
          ),
        ).then((response) => {
          return {
            boardId,
            boardName: boardDetails.find((board) => board.id === boardId)?.name,
            users: response.data,
          };
        });
      });

      // Wait for all requests to complete
      const responses = await Promise.all(requests);

      // Flatten the users array and enrich it with board information
      const users = responses.flatMap(({ boardId, boardName, users }) => {
        return users.map((user) => {
          return {
            ...user,
            boardId,
            boardName,
          };
        });
      });

      return users;
    } catch (error) {
      handleError(error);
    }
  }

  async getUserDetails(accountId: string): Promise<any> {
    try {
      const endpoint = `/members/${accountId}`;

      const credentials1 = this.getWorkspace1Credentials();
      const credentials2 = this.getWorkspace2Credentials();

      const results = await Promise.allSettled([
        firstValueFrom(
          this.httpService.get(`${this.trelloBaseUrl}${endpoint}`, {
            params: {
              key: credentials1.key,
              token: credentials1.token,
            },
          }),
        ),
        firstValueFrom(
          this.httpService.get(`${this.trelloBaseUrl}${endpoint}`, {
            params: {
              key: credentials2.key,
              token: credentials2.token,
            },
          }),
        ),
      ]);

      // Check if any response was successful
      const fulfilledResult = results.find(
        (result) => result.status === 'fulfilled',
      );

      if (fulfilledResult) {
        return (fulfilledResult as PromiseFulfilledResult<any>).value.data;
      }
    } catch (error) {
      handleError(error);
    }
  }

  async getUserIssues(accountId: string, date: string): Promise<any[]> {
    try {
      const boardsResponse1 = await firstValueFrom(
        this.httpService.get(
          `${this.trelloBaseUrl}/members/${accountId}/boards`,
          {
            params: {
              key: process.env.TRELLO_API_KEY,
              token: process.env.TRELLO_SECRET_KEY,
            },
          },
        ),
      );

      const boardsResponse2 = await firstValueFrom(
        this.httpService.get(
          `${this.trelloBaseUrl}/members/${accountId}/boards`,
          {
            params: {
              key: process.env.TRELLO_API_KEY2,
              token: process.env.TRELLO_SECRET_KEY2,
            },
          },
        ),
      );

      const boards1 = boardsResponse1.data.filter((board) =>
        [process.env.TRELLO_BOARD_ID_1, process.env.TRELLO_BOARD_ID_2].includes(
          board.id,
        ),
      );

      const boards2 = boardsResponse2.data.filter((board) =>
        [process.env.TRELLO_BOARD_ID_3].includes(board.id),
      );

      const allBoards = [...boards1, ...boards2];

      // Function to fetch cards for a specific board
      const fetchCardsForBoard = async (
        boardId: string,
        boardName: string,
        key: string,
        token: string,
      ): Promise<ITrelloCard[]> => {
        // Fetch lists for the board
        const listsResponse = await firstValueFrom(
          this.httpService.get(
            `${this.trelloBaseUrl}/boards/${boardId}/lists`,
            {
              params: {
                key: key,
                token: token,
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
                    key: key,
                    token: token,
                  },
                },
              ),
            );

            // Filter cards that belong to the user and are due on the specified date
            return cardsResponse.data
              .filter((card) => {
                return (
                  card.idMembers.includes(accountId) &&
                  card.due?.split('T')[0] === date
                );
              })
              .map((card) => {
                return {
                  cardId: card.id,
                  cardName: card.name,
                  listName: list.name,
                  boardName: boardName,
                  dueDate: card.due.split('T')[0],
                };
              });
          }),
        );

        return cards.flat();
      };

      // Step 4: Fetch cards for all boards
      const allCards = await Promise.all(
        allBoards.map((board) => {
          const key =
            board.id === process.env.TRELLO_BOARD_ID_3
              ? process.env.TRELLO_API_KEY2
              : process.env.TRELLO_API_KEY;
          const token =
            board.id === process.env.TRELLO_BOARD_ID_3
              ? process.env.TRELLO_SECRET_KEY2
              : process.env.TRELLO_SECRET_KEY;

          return fetchCardsForBoard(board.id, board.name, key, token);
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
  ): Promise<ISuccessResponse> {
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

      const existingHistory = user.issueHistory.find((history) => {
        return history.date === dateString;
      });
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
