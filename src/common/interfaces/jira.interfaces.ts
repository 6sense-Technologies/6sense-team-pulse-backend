import { User } from '../../modules/users/schemas/user.schema';

export interface IJiraUserData {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
}

export interface IGetAllUsersResponse {
  message: string;
  statusCode: number;
  users: IJiraUserData[];
  totalPages: number;
  currentPage: number;
  totalUsers: number;
}

export interface IJiraIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
  dueDate: string | null;
  created: string;
  storypoints?: number;
}

export interface IJirsUserIssues {
  message: string;
  statusCode: number;
  issues: IJiraIssue[];
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

export interface IAxiosError {
  isAxiosError: boolean;
  response?: {
    status: number;
    statusText: string;
    data: IJiraErrorResponse;
  };
  message: string;
}
