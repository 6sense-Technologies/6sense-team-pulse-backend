import { IComment } from '../../../common/interfaces/jira.interfaces';
import { IUser, User } from '../schemas/user.schema';

export interface IGetAllUsers {
  message: string;
  statusCode: number;
  users: User[];
  totalPages: number;
  currentPage: number;
  totalUsers: number;
}

export interface IGetUser {
  message: string;
  statusCode: number;
  user?: IUser;
}

export interface IUserIssuesByDate {
  userName: string;
  accountId: string;
  issues: any[];
  noOfBugs: number;
  comment: string;
  comments: IComment[];
}

export interface IUserWithPagination extends IUser {
  totalIssueHistory: number;
  currentPage: number;
  totalPages: number;
}
