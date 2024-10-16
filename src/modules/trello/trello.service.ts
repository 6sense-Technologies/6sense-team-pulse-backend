import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import { IIssue, User } from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ITrelloBoard,
  ITrelloCard,
  ITrelloCredentials,
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
import { Designation, Project } from '../users/enums/user.enum';

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

  private getWorkspace1Credentials(): ITrelloCredentials {
    return {
      key: process.env.TRELLO_API_KEY,
      token: process.env.TRELLO_SECRET_KEY,
    };
  }

  private getWorkspace2Credentials(): ITrelloCredentials {
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

    return response.data.map((board: { id: string; name: string }) => {
      return {
        id: board.id,
        name: board.name,
      };
    });
  }

  async getBoards(): Promise<ITrelloBoard[]> {
    const credentials1 = this.getWorkspace1Credentials();
    const credentials2 = this.getWorkspace2Credentials();

    const results = await Promise.allSettled([
      this.fetchBoards(credentials1),
      this.fetchBoards(credentials2),
    ]);

    const boards = results
      .filter((result) => {
        return result.status === 'fulfilled';
      })
      .flatMap((result) => {
        return (result as PromiseFulfilledResult<ITrelloBoard[]>).value;
      });

    return boards;
  }

  async getUsers(): Promise<ITrelloUsers[]> {
    try {
      const boardDetails = await this.getBoards();
      const endpoint = `/boards/{boardId}/members`;

      const requests = this.boardIds.map((boardId) => {
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
            boardName: boardDetails.find((board) => {
              return board.id === boardId;
            })?.name,
            users: response.data,
          };
        });
      });

      const responses = await Promise.all(requests);

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

      const fulfilledResult = results.find((result) => {
        return result.status === 'fulfilled';
      });

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

      const boards1 = boardsResponse1.data.filter((board) => {
        return [
          process.env.TRELLO_BOARD_ID_1,
          process.env.TRELLO_BOARD_ID_2,
        ].includes(board.id);
      });

      const boards2 = boardsResponse2.data.filter((board) => {
        return [process.env.TRELLO_BOARD_ID_3].includes(board.id);
      });

      const allBoards = [...boards1, ...boards2];

      const fetchCardsForBoard = async (
        boardId: string,
        boardName: string,
        key: string,
        token: string,
      ): Promise<ITrelloCard[]> => {
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

        const cards = await Promise.all(
          lists.map(async (list) => {
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

      const userCards = await this.getUserIssues(accountId, date);

      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

      const notDoneIssues = userCards.filter((card) => {
        return card.listName !== 'Done' && card.dueDate?.split('T')[0] === date;
      });

      const user = await this.userModel.findOne({ accountId });

      if (notDoneIssues.length === 0) {
        const existingHistory = user.issueHistory.find((history) => {
          return history.date === date;
        });
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

      notDoneIssues.forEach((card) => {
        const dueDate = card.dueDate.split('T')[0];
        const issueId = card.cardId;
        const summary = card.cardName;
        const status = card.listName;

        let issueType: 'Task' | 'Bug' | 'Story' = 'Task';
        if (card.listName === 'Bug') {
          issueType = 'Bug';
        } else if (card.listName === 'User Stories') {
          issueType = 'Story';
        }

        if (!countsByDate[dueDate]) {
          countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
          issuesByDate[dueDate] = [];
        }

        countsByDate[dueDate][issueType]++;

        issuesByDate[dueDate].push({
          issueId,
          summary,
          status,
          issueType,
          dueDate,
        });
      });

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

      const notDoneIssues =
        user?.issueHistory.find((entry) => {
          return entry.date === date;
        })?.notDoneIssues || [];

      const countsByDate: {
        [key: string]: { Task: number; Bug: number; Story: number };
      } = {};
      const issuesByDate: { [key: string]: IIssue[] } = {};

      userCards.forEach((card) => {
        const dueDate = card.dueDate.split('T')[0];
        const issueId = card.cardId;
        const summary = card.name;
        const status = card.listName;

        if (!countsByDate[dueDate]) {
          countsByDate[dueDate] = { Task: 0, Bug: 0, Story: 0 };
          issuesByDate[dueDate] = [];
        }

        issuesByDate[dueDate].push({
          issueId,
          summary,
          status,
          dueDate,
        });

        if (card.listName === 'Done' || card.listName === 'In Review') {
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
        return history.date === date;
      });
      if (existingHistory) {
        existingHistory.issuesCount.done = countsByDate[date] || {
          Task: 0,
          Bug: 0,
          Story: 0,
        };
        existingHistory.doneIssues = issuesByDate[date] || [];
      } else {
        user.issueHistory.push({
          date: date,
          issuesCount: {
            done: countsByDate[date] || { Task: 0, Bug: 0, Story: 0 },
          },
          doneIssues: issuesByDate[date] || [],
        });
      }

      await user.save();

      await this.userService.fetchAndSaveAllIssues(accountId, date);
    } catch (error) {
      handleError(error);
    }
  }
}
