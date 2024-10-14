import { IUser, User } from '../../modules/users/schemas/user.schema';

export interface IJiraUserData {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
}

export interface IUserResponse {
  message: string;
  statusCode: number;
  user?: IUser;
}

export interface IGetAllUsersResponse {
  message: string;
  statusCode: number;
  users: IJiraUserData[];
  totalPages: number;
  currentPage: number;
  totalUsers: number;
}

export interface IJiraIssues {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
  };
}

export interface IJirsUserIssues {
  message: string;
  statusCode: number;
  issues: IJiraIssues[];
}

export interface IUserWithPagination extends IUser {
  totalIssueHistory: number;
  currentPage: number;
  totalPages: number;
}

export interface ITrelloUserData {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
  currentPerformance?: number;
}

export interface IComment {
  comment: string;
  timestamp: Date;
}

export interface IGetIssuesByDateResponse {
  userName: string;
  accountId: string;
  issues: any[];
  noOfBugs: number;
  comment: string;
  comments: IComment[];
}

export interface IJiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, any>;
  message?: string;
}

export interface IDailyMetrics {
  date: string;
  numberOfTasks: number;
  numberOfBugs: number;
  numberOfUserStories: number;
  completedTasks: number;
  completedUserStories: number;
  taskCompletionRate: number;
  userStoryCompletionRate: number;
  overallScore: number;
  comment: string;
  codeToBugRatio: number;
}

export interface ISuccessResponse {
  statusCode: number;
  message: string;
  user?: User;
}
