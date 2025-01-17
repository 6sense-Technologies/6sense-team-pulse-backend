import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ISuccessResponse } from '../../common/interfaces/jira.interfaces';
import { IssueHistory } from './schemas/IssueHistory.schems';
import { IssueEntry } from './schemas/IssueEntry.schema';
import { ConfigService } from '@nestjs/config';
import { handleError } from '../../common/helpers/error.helper';
import {
  validateAccountId,
  validateDate,
  validatePagination,
} from '../../common/helpers/validation.helper';
import {
  IAllUsers,
  IUserResponse,
  IUserIssuesByDate,
  IUserWithPagination,
} from './interfaces/users.interfaces';
import { Project } from './schemas/Project.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { JiraService } from '../jira/jira.service';
import { TrelloService } from '../trello/trello.service';
import { UserProject } from './schemas/UserProject.schema';
// import { Comment } from './schemas/Comment.schema';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @Inject(forwardRef(() => JiraService))
    private readonly jiraService: JiraService,
    @Inject(forwardRef(() => TrelloService))
    private readonly trelloService: TrelloService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(IssueHistory.name)
    private readonly issueHistoryModel: Model<IssueHistory>,
    @InjectModel(IssueEntry.name)
    private readonly issueEntryModel: Model<IssueEntry>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<Project>,
    @InjectModel(UserProject.name)
    private readonly userProjectModel: Model<UserProject>,
    private readonly configService: ConfigService,
  ) {
    //Nothing
  }

  /// EXPERIMENTAL MODIFICATION
  async calculateIndividualStats(userId: string, page: number, limit: number) {
    const result = await this.issueEntryModel.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          issueType: { $in: ['Task', 'Story', 'Bug'] },
        },
      },
      {
        $group: {
          _id: '$date', // Group by the 'date' field
          doneTaskCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Task'] },
                    {
                      $in: ['$issueStatus', ['Done', 'In Review']],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneTaskCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Task'] },
                    {
                      $not: { $in: ['$issueStatus', ['Done', 'In Review']] },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          doneStoryCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Story'] },
                    {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'USER STORIES (Verified In Test)',
                          'USER STORIES (Verified In Beta)',
                        ],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneStoryCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Story'] },
                    {
                      $not: {
                        $in: [
                          '$issueStatus',
                          [
                            'Done',
                            'USER STORIES (Verified In Test)',
                            'USER STORIES (Verified In Beta)',
                          ],
                        ],
                      },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          doneBugCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Bug'] },
                    { $eq: ['$issueStatus', 'Done'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneBugCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Bug'] },
                    { $ne: ['$issueStatus', 'Done'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          comment: { $first: '$comment' }, //getting the first one from each group
        },
      },
      {
        $project: {
          date: '$_id', // Rename _id to date
          doneTaskCount: 1,
          notDoneTaskCount: 1,
          doneStoryCount: 1,
          notDoneStoryCount: 1,
          doneBugCount: 1,
          notDoneBugCount: 1,
          comment: 1, // Include the first comment
          user: 1,
          // Calculate ratios
          taskRatio: {
            $cond: {
              if: {
                $eq: [{ $add: ['$doneTaskCount', '$notDoneTaskCount'] }, 0],
              }, // If the total count is 0, set ratio to null
              then: 0,
              else: {
                $divide: [
                  '$doneTaskCount',
                  { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                ],
              }, // done / (done + not done)
            },
          },
          storyRatio: {
            $cond: {
              if: {
                $eq: [{ $add: ['$doneStoryCount', '$notDoneStoryCount'] }, 0],
              },
              then: 0,
              else: {
                $divide: [
                  '$doneStoryCount',
                  { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                ],
              },
            },
          },
          bugRatio: {
            $cond: {
              if: {
                $eq: [{ $add: ['$doneBugCount', '$notDoneBugCount'] }, 0],
              },
              then: 0,
              else: {
                $divide: [
                  '$doneBugCount',
                  { $add: ['$doneBugCount', '$notDoneBugCount'] },
                ],
              },
            },
          },
          score: {
            // $divide: [{ $add: ['$taskRatio', '$storyRatio'] },],
            $divide: [
              {
                $add: [
                  {
                    $cond: {
                      if: {
                        $eq: [
                          { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                          0,
                        ],
                      },
                      then: 0,
                      else: {
                        $divide: [
                          '$doneTaskCount',
                          { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                        ],
                      },
                    },
                  },
                  {
                    $cond: {
                      if: {
                        $eq: [
                          { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                          0,
                        ],
                      },
                      then: 0,
                      else: {
                        $divide: [
                          '$doneStoryCount',
                          { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                        ],
                      },
                    },
                  },
                ],
              },
              2,
            ],
          },
          _id: 0, // Remove the _id field
        },
      },
      {
        $sort: { date: 1 }, // Sort by date in ascending order
      },
      {
        $facet: {
          total: [{ $count: 'total' }],
          data: [
            { $skip: (Number(page) - 1) * Number(limit) },
            { $limit: Number(limit) },
          ],
        },
      },
      {
        $unwind: '$total',
      },
      {
        $project: {
          count: '$total.total',
          data: 1,
        },
      },
    ]);

    const userData = await this.userModel
      .findById(userId)
      .select('displayName emailAddress designation avatarUrls');
    return {
      userData: userData,
      history: result[0],
    };
  }
  async calculateOverview(page: Number, limit: Number) {
    // const count = await this.userModel.countDocuments();
    const result = await this.issueEntryModel.aggregate([
      {
        $match: {
          comment: { $ne: 'holidays/leave' },
        },
      },
      {
        $group: {
          _id: '$user',
          doneTaskCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Task'] },
                    {
                      $in: ['$issueStatus', ['Done', 'In Review']],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneTaskCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Task'] },
                    {
                      $not: { $in: ['$issueStatus', ['Done', 'In Review']] },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          doneStoryCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Story'] },
                    {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'USER STORIES (Verified In Test)',
                          'USER STORIES (Verified In Beta)',
                        ],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneStoryCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Story'] },
                    {
                      $not: {
                        $in: [
                          '$issueStatus',
                          [
                            'Done',
                            'USER STORIES (Verified In Test)',
                            'USER STORIES (Verified In Beta)',
                          ],
                        ],
                      },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          doneBugCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Bug'] },
                    { $eq: ['$issueStatus', 'Done'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notDoneBugCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$issueType', 'Bug'] },
                    { $ne: ['$issueStatus', 'Done'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          comment: { $first: '$comment' }, //getting the first one from each group
        },
      },
      {
        $project: {
          score: {
            // $divide: [{ $add: ['$taskRatio', '$storyRatio'] },],
            $divide: [
              {
                $add: [
                  {
                    $cond: {
                      if: {
                        $eq: [
                          { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                          0,
                        ],
                      },
                      then: 0,
                      else: {
                        $divide: [
                          '$doneTaskCount',
                          { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                        ],
                      },
                    },
                  },
                  {
                    $cond: {
                      if: {
                        $eq: [
                          { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                          0,
                        ],
                      },
                      then: 0,
                      else: {
                        $divide: [
                          '$doneStoryCount',
                          { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                        ],
                      },
                    },
                  },
                ],
              },
              2,
            ],
          },
          _id: 1,
        },
      },
      {
        $sort: { date: 1 }, // Sort by date in ascending order
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData',
        },
      },
      {
        $unwind: '$userData',
      },
      {
        $project: {
          'userData.displayName': 1,
          'userData.emailAddress': 1,
          'userData.designation': 1,
          'userData.avatarUrls': 1,
          score: 1,
        },
      },
      {
        $facet: {
          total: [{ $count: 'total' }],
          data: [
            { $skip: (Number(page) - 1) * Number(limit) },
            { $limit: Number(limit) },
          ],
        },
      },
      {
        $unwind: '$total',
      },
      {
        $project: {
          count: '$total.total',
          data: 1,
        },
      },
      ///bring out userData
      // {
      //   $replaceRoot: { newRoot: { $mergeObjects: ["$userData", "$$ROOT"] } }
      // },
      // {
      //   $project:{
      //     'userData':0
      //   }
      // }
    ]);

    return result[0];
  }
  // ----------------------------------------------------------------------------//

  async createUser(createUserDto: CreateUserDto) {
    if (!createUserDto.jiraId && !createUserDto.trelloId) {
      throw new BadRequestException('Jira/Trello id is required');
    }
    let userToSave = {
      jiraAccountId: '',
      trelloAccountId: '',
      displayName: '',
      emailAddress: '',
      avatarUrls: '',
      designation: createUserDto.designation,
      // project,
      // userFrom,
    };
    const projects = await this.projectModel.find({
      _id: { $in: createUserDto.projects },
    });
    this.logger.log(projects);
    // return;
    if (createUserDto.jiraId) {
      const project = projects.find((project) => {
        return project.tool == 'jira';
      });
      if (project) {
        this.logger.log(project);
        try {
          const jiraUser = await this.jiraService.getUserDetailsFromJira(
            project.toolURL,
            createUserDto.jiraId,
          );
          if (jiraUser) {
            userToSave = {
              ...userToSave,
              jiraAccountId: jiraUser.accountId,
              displayName: jiraUser.displayName,
              emailAddress: jiraUser.emailAddress,
              avatarUrls: jiraUser.avatarUrls['48x48'],
            };
            this.logger.log(jiraUser);
          } else {
            throw new BadRequestException({
              error: `The user doesn\'t have access to any Jira Workspace`,
            });
          }
        } catch (error) {
          this.logger.error(error);
          throw new BadRequestException({
            error: `The user doesn\'t have access to the Jira Workspace named ${project.name}`,
          });
        }
      } else {
        throw new BadRequestException({
          error: `The user doesn\'t have access to any Jira Workspace`,
        });
      }
    }

    if (createUserDto.trelloId) {
      const project = projects.find((project) => {
        return project.tool == 'trello';
      });
      if (project) {
        this.logger.log(project);
        try {
          const trelloUser = await this.trelloService.getUserDetailsFromTrello(
            project.toolURL,
            createUserDto.trelloId,
          );
          if (trelloUser) {
            if (!userToSave.displayName && trelloUser.fullName) {
              userToSave.displayName = trelloUser.fullName;
            }
            if (!userToSave.emailAddress && trelloUser.email) {
              userToSave.emailAddress = trelloUser.email;
            }
            userToSave.trelloAccountId = trelloUser.id;
            this.logger.log(trelloUser);
          } else {
            throw new BadRequestException({
              error: 'invalid_trello',
              message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
            });
          }
        } catch (error) {
          this.logger.error(error);
          throw new BadRequestException({
            error: 'invalid_trello',
            message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
          });
        }
      } else {
        throw new BadRequestException({
          error: 'invalid_trello',
          message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
        });
      }
    }
    let orQuery = [];
    if (userToSave.jiraAccountId)
      orQuery.push({ jiraAccountId: userToSave.jiraAccountId });
    if (userToSave.trelloAccountId)
      orQuery.push({ trelloAccountId: userToSave.trelloAccountId });
    const existingUser = await this.userModel.findOne({ $or: orQuery });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const user = await this.userModel.create(userToSave);
    let userProjects = [];
    projects.forEach((project) => {
      userProjects.push({
        user: user._id,
        project: project._id,
      });
    });
    await this.userProjectModel.insertMany(userProjects);
    return user;
  }
  // TODO: NEED TO FIX THIS
  async getAllUsers(page = 1, limit = 10): Promise<IAllUsers> {
    try {
      validatePagination(page, limit);

      const skip = (page - 1) * limit;
      const totalUsers = await this.userModel.countDocuments({
        isArchive: false,
      });

      const users = await this.userModel
        .find(
          { isArchive: false },
          'accountId displayName emailAddress avatarUrls currentPerformance designation project',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalPages = Math.ceil(totalUsers / limit);

      return {
        message: 'Users found successfully',
        statusCode: 200,
        users,
        totalPages,
        currentPage: page,
        totalUsers,
      };
    } catch (error) {
      handleError(error);
    }
  }
  //TODO: NEED TO FIX THIS
  async getUser(
    accountId: string,
    page = 1,
    limit = 30,
  ): Promise<IUserResponse> {
    // try {
    validateAccountId(accountId);
    validatePagination(page, limit);

    // const user = await this.userModel.findOne({ _id: accountId }).exec();
    const aggregate = [];
    aggregate.push({ $match: { _id: new mongoose.Types.ObjectId(accountId) } });
    aggregate.push({
      $lookup: {
        from: 'userprojects',
        localField: '_id',
        foreignField: 'user',
        as: 'projects',
      },
    });
    aggregate.push({
      $unwind: { path: '$projects', preserveNullAndEmptyArrays: true },
    });
    aggregate.push({
      $lookup: {
        from: 'projects', // The collection where project details are stored
        localField: 'projects.project',
        foreignField: '_id',
        as: 'projects.projectDetails',
      },
    });

    aggregate.push({
      $group: {
        _id: '$_id',
        jiraAccountId: { $first: '$jiraAccountId' },
        trelloAccountId: { $first: '$trelloAccountId' },
        accountId: { $first: '$accountId' },
        displayName: { $first: '$displayName' },
        emailAddress: { $first: '$emailAddress' },
        avatarUrls: { $first: '$avatarUrls' },
        designation: { $first: '$designation' },
        project: { $first: '$project' },
        isArchive: { $first: '$isArchive' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
        projects: { $push: '$projects' },
      },
    });
    const userResult = await this.userModel.aggregate(aggregate);
    if (!userResult) {
      throw new NotFoundException('User not found');
    }
    return {
      message: 'User found successfully',
      statusCode: 200,
      user: userResult[0],
    };
    const user = userResult[0];
    const skip = (page - 1) * limit;

    const totalIssueHistory = user.issueHistory?.length;
    const sortedIssueHistory = user.issueHistory
      ?.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(skip, skip + limit);

    const totalPages = Math.ceil(totalIssueHistory / limit);

    const userWithPagination: IUserWithPagination = {
      ...user.toObject(),
      issueHistory: sortedIssueHistory,
      totalIssueHistory,
      currentPage: page,
      totalPages,
    };

    return {
      message: 'User found successfully',
      statusCode: 200,
      user: userWithPagination,
    };
    // } catch (error) {
    //   handleError(error);
    // }
  }

  async deleteUser(accountId: string): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);

      const existingUser = await this.userModel.findOne({ accountId });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      await this.userModel.findOneAndDelete({ accountId });

      return {
        message: 'User deleted successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async archiveUser(accountId: string): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);

      const user = await this.userModel.findOne({ accountId });

      if (!user) {
        throw new NotFoundException('User with accountId not found');
      }

      if (user.isArchive) {
        throw new ConflictException('User is already archived');
      }

      user.isArchive = true;
      await user.save();

      return {
        message: 'User archived successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async fetchAndSavePlannedIssues(
    accountId: string,
    date: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const user = await this.userModel.findOne({ accountId }).exec();

      const notDoneIssues =
        user.issueHistory.find((history) => {
          return history.date === date;
        })?.notDoneIssues || [];

      const issueHistoryEntries = notDoneIssues.map((issue, index) => {
        return {
          serialNumber: index + 1,
          issueType: issue.issueType,
          issueId: issue.issueId,
          issueSummary: issue.summary,
          issueStatus: issue.status,
          planned: true,
          link: issue.issueLinks
            ? issue.issueLinks
                .map((link) => {
                  return link.issueId;
                })
                .join(',')
            : '',
        };
      });

      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
        {
          $set: {
            [`history.${date}`]: {
              issues: issueHistoryEntries,
            },
          },
        },
        { upsert: true, new: true },
      );

      return {
        statusCode: 200,
        message: 'Planned issues have been successfully updated.',
      };
    } catch (error) {
      handleError(error);
    }
  }

  async fetchAndSaveAllIssues(
    accountId: string,
    date: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const user = await this.userModel.findOne({ accountId }).exec();

      const issueHistory = await this.issueHistoryModel
        .findOne({ accountId: user.accountId })
        .exec();

      const specificDateHistory = issueHistory.history[date] || {
        issues: [],
      };

      const doneIssues =
        user.issueHistory.find((history) => {
          return history.date === date;
        })?.doneIssues || [];

      const doneIssueIds = new Set(
        doneIssues.map((issue) => {
          return issue.issueId;
        }),
      );

      const notDoneIssueIds = new Set(
        specificDateHistory.issues.map((issue) => {
          return issue.issueId;
        }),
      );

      specificDateHistory.issues = specificDateHistory.issues.map((issue) => {
        if (doneIssueIds.has(issue.issueId)) {
          const matchedDoneIssue = doneIssues.find((done) => {
            return done.issueId === issue.issueId;
          });

          const linkedIssueIdsSet = new Set<string>();
          matchedDoneIssue?.issueLinks?.forEach((link) => {
            linkedIssueIdsSet.add(link.issueId);
          });

          return {
            ...issue,
            issueStatus: matchedDoneIssue?.status || issue.issueStatus,
            link: Array.from(linkedIssueIdsSet).join(','),
          };
        }
        return issue;
      });

      const newDoneIssueEntries: IssueEntry[] = doneIssues
        .filter((issue) => {
          return !notDoneIssueIds.has(issue.issueId);
        })
        .map((issue, index) => {
          const linkedIssueIdsSet = new Set<string>();
          issue.issueLinks?.forEach((link) => {
            linkedIssueIdsSet.add(link.issueId);
          });

          return new this.issueEntryModel({
            serialNumber: specificDateHistory.issues.length + index + 1,
            issueType: issue.issueType,
            issueId: issue.issueId,
            issueSummary: issue.summary,
            issueStatus: issue.status,
            link: Array.from(linkedIssueIdsSet).join(','),
          });
        });

      specificDateHistory.issues.push(...newDoneIssueEntries);
      await this.issueHistoryModel.findOneAndUpdate(
        { userName: user.displayName, accountId: user.accountId },
        { $set: { [`history.${date}`]: specificDateHistory } },
        { upsert: true, new: true },
      );

      return {
        statusCode: 200,
        message: 'Issues have been successfully updated.',
      };
    } catch (error) {
      handleError(error);
    }
  }

  async getIssuesByDate(
    accountId: string,
    date: string,
  ): Promise<IUserIssuesByDate> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const historyPath = `history.${date}`;

      const result = await this.issueHistoryModel
        .findOne(
          { accountId, [historyPath]: { $exists: true, $ne: null } },
          { userName: 1, accountId: 1, [historyPath]: 1 },
        )
        .exec();

      if (!result || !result.history[date]) {
        return {
          userName: result?.userName || '',
          accountId: result?.accountId || '',
          issues: [],
          noOfBugs: 0,
          comment: '',
          comments: [],
        };
      }

      const { issues, noOfBugs, comment, comments } = result.history[date];

      const sortedComments = comments
        ? comments.sort((a, b) => {
            return b.timestamp.getTime() - a.timestamp.getTime();
          })
        : [];

      return {
        userName: result.userName,
        accountId: result.accountId,
        issues,
        noOfBugs: noOfBugs || 0,
        comment: comment || '',
        comments: sortedComments,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async bugReportByDate(
    accountId: string,
    date: string,
    noOfBugs: number,
    comment: string,
    token: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const envToken = this.configService.get<string>('REPORT_BUG_TOKEN');
      if (!token || token !== envToken) {
        throw new ForbiddenException('Invalid or missing token');
      }

      const user = await this.userModel.findOne({ accountId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userIssueEntry = user.issueHistory.find((entry) => {
        return entry.date === date;
      });

      if (userIssueEntry) {
        userIssueEntry.reportBug = { noOfBugs, comment };
        await user.save();
      } else {
        throw new NotFoundException('No issue history found');
      }

      await this.issueHistoryModel.findOneAndUpdate(
        { accountId, [`history.${date}`]: { $exists: true } },
        {
          $set: {
            [`history.${date}.noOfBugs`]: noOfBugs,
            [`history.${date}.comment`]: comment,
          },
        },
        { upsert: true, new: true },
      );

      return {
        message: 'Bug report updated successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async createComment(
    accountId: string,
    date: string,
    comment: string,
  ): Promise<ISuccessResponse> {
    try {
      validateAccountId(accountId);
      validateDate(date);

      const user = await this.userModel.findOne({ accountId }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const historyPath = `history.${date}`;
      const issueHistory = await this.issueHistoryModel
        .findOne({ accountId, [historyPath]: { $exists: true } })
        .exec();

      if (!issueHistory || !issueHistory.history[date]) {
        throw new NotFoundException(
          'Issue history for the specified date not found',
        );
      }

      const newComment = {
        comment,
        timestamp: new Date(),
      };

      await this.issueHistoryModel.findOneAndUpdate(
        { accountId, [`history.${date}`]: { $exists: true } },
        { $push: { [`history.${date}.comments`]: newComment } },
        { new: true },
      );

      return {
        message: 'Comment added successfully',
        statusCode: 200,
      };
    } catch (error) {
      handleError(error);
    }
  }

  async getProjects() {
    // const projects = Object.values(Project);
    // return { projects };
    return this.projectModel.find();
  }
}
