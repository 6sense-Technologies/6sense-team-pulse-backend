import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Mongoose, Types } from 'mongoose';
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
import { FileInterceptor } from '@nestjs/platform-express';

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
import { overView } from './aggregations/overview.aggregation';
import { individualStats } from './aggregations/individualStats.aggregation';
import { monthlyStat } from './aggregations/individualMonthlyPerformence.aggregation';
import { dailyPerformenceAgg } from './aggregations/dailyPerformence.aggregation';
import { Organization } from './schemas/Organization.schema';
import { InviteUserDTO } from './dto/invite-user.dto';
import { OrganizationUserRole } from './schemas/OrganizationUserRole.schema';
import { Role } from './schemas/Role.schema';
import { OrganizationProjectUser } from './schemas/OrganizationProjectUser.schema';
import { Users } from './schemas/users.schema';
import { EmailService } from '../email-service/email-service.service';
import { Designation } from './enums/user.enum';
import axios from 'axios';
import { getRoles } from './aggregations/organizationuserRole.aggregation';
// import { Comment } from './schemas/Comment.schema';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly API_URL = 'https://api.imgbb.com/1/upload';
  private readonly API_KEY = process.env.IMGBB_API_KEY;

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
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(OrganizationUserRole.name)
    private readonly organizationUserRoleModel: Model<OrganizationUserRole>,

    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
    @InjectModel(OrganizationProjectUser.name)
    private readonly organizationProjectUserModel: Model<OrganizationProjectUser>,
    @InjectModel(Users.name)
    private readonly newusersModel: Model<Users>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    //Nothing
  }

  /// EXPERIMENTAL MODIFICATION
  async getUserInfo(userId: string): Promise<{
    userData: any;
    currentMonthScore: number;
    lastMonthScore: number;
  }> {
    let today = new Date();

    // Current month start date
    let currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    ).toISOString();

    // Last month start date
    let lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    ).toISOString();

    // Last month end date
    let lastMonthEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      0,
    ).toISOString();

    const currentMonthAgg: any = monthlyStat(userId, currentMonthStart);
    const currentMonth = await this.issueEntryModel.aggregate(currentMonthAgg);

    const lastMonthAgg: any = monthlyStat(userId, lastMonthStart, lastMonthEnd);
    const lastMonth = await this.issueEntryModel.aggregate(lastMonthAgg);
    // console.log(currentMonth);
    // console.log(lastMonth);
    const userData = await this.userModel
      .findById(userId)
      .select('displayName emailAddress designation avatarUrls isDisabled');
    // console.log(userData);
    if (!('isDisabled' in userData)) {
      userData['isDisabled'] = false;
    }
    if (currentMonth.length == 0) {
      currentMonth.push({ averageScore: 0 });
    }
    if (lastMonth.length == 0) {
      lastMonth.push({ averageScore: 0 });
    }

    return {
      userData: userData,
      currentMonthScore: currentMonth[0]['averageScore'],
      lastMonthScore: lastMonth[0]['averageScore'],
    };
  }
  async sendMailInvitationEmail(
    emailAddress: string,
    fromUser: string,
    organizationName: string,
  ) {
    const emailSentResponse = await this.emailService.sendInvitationEmail(
      emailAddress,
      fromUser,
      organizationName,
    );
    return emailSentResponse;
  }
  async calculateIndividualStats(userId: string, page: number, limit: number) {
    const individualStatAggregation: any = individualStats(userId, page, limit);
    const result = await this.issueEntryModel.aggregate(
      individualStatAggregation,
    );
    let today = new Date();
    /// TODO: remove duplicate codes created seperate api for getUserInfo so current month performance and last month performance is not needed
    // Current month start date
    let currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    ).toISOString();

    // Last month start date
    let lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    ).toISOString();

    // Last month end date
    let lastMonthEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      0,
    ).toISOString();

    const currentMonthAgg: any = monthlyStat(userId, currentMonthStart);
    const currentMonth = await this.issueEntryModel.aggregate(currentMonthAgg);

    const lastMonthAgg: any = monthlyStat(userId, lastMonthStart, lastMonthEnd);
    const lastMonth = await this.issueEntryModel.aggregate(lastMonthAgg);
    // console.log(currentMonth);
    // console.log(lastMonth);
    const userData = await this.userModel
      .findById(userId)
      .select('displayName emailAddress designation avatarUrls isDisabled');

    if (currentMonth.length == 0) {
      currentMonth.push({ averageScore: 0 });
    }
    if (lastMonth.length == 0) {
      lastMonth.push({ averageScore: 0 });
    }
    const userObject = userData.toObject();
    if (!('isDisabled' in userObject)) {
      userObject['isDisabled'] = false;
    }
    return {
      userData: userObject,
      history: result[0] || [],
      currentMonthScore: currentMonth[0]['averageScore'] || 0,
      lastMonthScore: lastMonth[0]['averageScore'] || 0,
    };
  }
  async calculateOverview(
    page: Number,
    limit: Number,
    userId: string,
  ): Promise<any[]> {
    // const count = await this.userModel.countDocuments();
    // console.log(`${page}--${limit}`);
    // Get the current date and subtract 30 days
    const todaysDate = new Date();
    const thirtyDaysAgo = todaysDate.setDate(todaysDate.getDate() - 30);
    const thirtyDaysAgoDate = new Date(thirtyDaysAgo).toISOString();

    const orgUserRoleModel = await this.organizationUserRoleModel
      .findOne({
        user: new Types.ObjectId(userId),
      })
      .populate('organization');
    // console.log(orgUserRoleModel);

    // console.log(orgUserRoleModel['organization']['createdBy']);
    const teamMembers = orgUserRoleModel.organization['users'];
    const organizationId = orgUserRoleModel.organization.id.toString();
    console.log(`Organization Id : ${organizationId}`);
    const overViewAggr: any = overView(
      thirtyDaysAgoDate,
      page,
      limit,
      teamMembers,
    );
    const roles: any = await this.organizationUserRoleModel.aggregate(
      getRoles(teamMembers, organizationId),
    );
    const roleMap = roles.reduce((map, { user, roleName }) => {
      map[user.toString()] = roleName; // Convert ObjectId to string for key
      return map;
    }, {});
    const result = await this.issueEntryModel.aggregate(overViewAggr);

    if (result.length === 0) {
      return [{}];
    }
    console.log(roleMap);
    for (let i = 0; i < result[0]['data'].length; i += 1) {
      const roleName = roleMap[result[0]['data'][i]._id.toString()];
      let roleNameUpper = '';
      if (roleName) {
        roleNameUpper =
          String(roleName[0]).toUpperCase() + String(roleName).slice(1);
      }
      if (!roleName) {
        roleNameUpper = 'Member';
      }
      result[0]['data'][i]['role'] = roleNameUpper || 'Member';
    }
    return result[0];
  }

  async inviteUser(
    inviteUserDTO: InviteUserDTO,
    userId: string,
    file: Express.Multer.File,
  ) {
    let avatarUrl = 'https://i.ibb.co/6J1Tn7Xc/user-8664801.png';
    if (file) {
      const base64Image = file.buffer.toString('base64');

      // Build URL-encoded parameters (the API expects the parameter name "image")
      const params = new URLSearchParams();
      params.append('image', base64Image);

      try {
        const response = await axios.post(
          `${this.API_URL}?expiration=600&key=${this.API_KEY}`,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );
        avatarUrl = response.data.data.url;
        console.log('Upload successful:', avatarUrl);
      } catch (error) {
        console.error(
          'Upload failed:',
          error.response ? error.response.data : error.message,
        );
      }
    }
    const [role, organizationUserRole, existingUser] = await Promise.all([
      this.roleModel.findOne({ roleName: inviteUserDTO.role }),
      this.organizationUserRoleModel
        .findOne({
          user: new Types.ObjectId(userId),
        })
        .populate('organization')
        .populate('user')
        .lean(),
      this.newusersModel.findOne({ emailAddress: inviteUserDTO.emailAddress }),
    ]);
    // console.log(organizationUserRole);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    if (!role) {
      throw new BadRequestException('Invalid role');
    }
    if (!organizationUserRole) {
      throw new InternalServerErrorException('Admin has no organization');
    }

    const user = await this.newusersModel.create({
      displayName: inviteUserDTO.displayName,
      designation: inviteUserDTO.designation,
      emailAddress: inviteUserDTO.emailAddress,
      jiraId: inviteUserDTO.jiraId,
      trelloId: inviteUserDTO.trelloId,
      githubUserName: inviteUserDTO.githubUserName,
      avatarUrls: avatarUrl,
      isInvited: true,
      isDisabled: false,
      isVerified: false,
    });

    await this.organizationUserRoleModel.create({
      role: role._id,
      user: user._id,
      organization: organizationUserRole.organization._id,
    });
    if (!inviteUserDTO.projects) {
      await this.sendMailInvitationEmail(
        user.emailAddress,
        organizationUserRole['user']['displayName'],
        organizationUserRole['organization']['organizationName'],
      );
      return user;
    }
    if (inviteUserDTO.projects.length === 0) {
      await this.sendMailInvitationEmail(
        user.emailAddress,
        organizationUserRole['user']['displayName'],
        organizationUserRole['organization']['organizationName'],
      );
      return user;
    }
    const projects = await this.projectModel.find({
      name: { $in: inviteUserDTO.projects },
    });
    if (projects.length !== inviteUserDTO.projects.length) {
      throw new BadRequestException('One or more project names are invalid');
    }

    const projectUserEntries = projects.map((project) => ({
      organization: organizationUserRole._id,
      project: project._id,
      user: user._id,
    }));

    await this.organizationProjectUserModel.insertMany(projectUserEntries);
    console.log('DONE');
    await this.organizationModel.findOneAndUpdate(
      {
        organizationName:
          organizationUserRole['organization']['organizationName'],
      },
      { $push: { users: user._id } },
      { new: true }, // Returns the updated document
    );

    await this.sendMailInvitationEmail(
      user.emailAddress,
      organizationUserRole['user']['displayName'],
      organizationUserRole['organization']['organizationName'],
    );

    return user;
  }
  async toggleEnable(userId: string, adminId: string) {
    // const orgUserRole = await this.organizationUserRoleModel.findOne({
    //   user: new Types.ObjectId(userId),
    // });
    // if (!orgUserRole) {
    //   throw new NotFoundException('User not found in any organization');
    // }
    // orgUserRole.isDisabled = !orgUserRole.isDisabled;
    // await orgUserRole.save();
    // if (orgUserRole.isDisabled) {
    //   return { enabled: true };
    // } else {
    //   return { enabled: false };
    // }

    const user = await this.newusersModel.findById(userId);
    user['isDisabled'] = !user['isDisabled'];
    await user.save();
    return { isEnabled: user.isDisabled };
  }
  async dailyPerformence(
    userId: string,
    dateTime: string,
    page: Number,
    limit: Number,
  ) {
    const aggdailyPerformence: any = dailyPerformenceAgg(
      userId,
      dateTime,
      page,
      limit,
    );
    const userData = await this.userModel
      .findById(userId)
      .select('displayName emailAddress designation avatarUrls');
    const dailyPerformance =
      await this.issueEntryModel.aggregate(aggdailyPerformence);
    return {
      userData,
      dailyPerformance: dailyPerformance[0] || [],
    };
  }

  // ----------------------------------------------------------------------------//
  /* istanbul ignore next */
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
    // if (createUserDto.jiraId) {
    //   const project = projects.find((project) => {
    //     return project.tool == 'jira';
    //   });
    //   if (project) {
    //     this.logger.log(project);
    //     try {
    //       const jiraUser = await this.jiraService.getUserDetailsFromJira(
    //         project.toolURL,
    //         createUserDto.jiraId,
    //       );
    //       if (jiraUser) {
    //         userToSave = {
    //           ...userToSave,
    //           jiraAccountId: jiraUser.accountId,
    //           displayName: jiraUser.displayName,
    //           emailAddress: jiraUser.emailAddress,
    //           avatarUrls: jiraUser.avatarUrls['48x48'],
    //         };
    //         this.logger.log(jiraUser);
    //       } else {
    //         throw new BadRequestException({
    //           error: `The user doesn\'t have access to any Jira Workspace`,
    //         });
    //       }
    //     } catch (error) {
    //       this.logger.error(error);
    //       throw new BadRequestException({
    //         error: `The user doesn\'t have access to the Jira Workspace named ${project.name}`,
    //       });
    //     }
    //   } else {
    //     throw new BadRequestException({
    //       error: `The user doesn\'t have access to any Jira Workspace`,
    //     });
    //   }
    // }

    // if (createUserDto.trelloId) {
    //   const project = projects.find((project) => {
    //     return project.tool == 'trello';
    //   });
    //   if (project) {
    //     this.logger.log(project);
    //     try {
    //       const trelloUser = await this.trelloService.getUserDetailsFromTrello(
    //         project.toolURL,
    //         createUserDto.trelloId,
    //       );
    //       if (trelloUser) {
    //         if (!userToSave.displayName && trelloUser.fullName) {
    //           userToSave.displayName = trelloUser.fullName;
    //         }
    //         if (!userToSave.emailAddress && trelloUser.email) {
    //           userToSave.emailAddress = trelloUser.email;
    //         }
    //         userToSave.trelloAccountId = trelloUser.id;
    //         this.logger.log(trelloUser);
    //       } else {
    //         throw new BadRequestException({
    //           error: 'invalid_trello',
    //           message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
    //         });
    //       }
    //     } catch (error) {
    //       this.logger.error(error);
    //       throw new BadRequestException({
    //         error: 'invalid_trello',
    //         message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
    //       });
    //     }
    //   } else {
    //     throw new BadRequestException({
    //       error: 'invalid_trello',
    //       message: `The user doesn\'t have access to the Trello Workspace named ${project.name}`,
    //     });
    //   }
    // }
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
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
  /* istanbul ignore next */
  async getProjects() {
    // const projects = Object.values(Project);
    // return { projects };
    return this.projectModel.find();
  }
}
