import { IUser } from "../modules/users/schemas/user.schema";

export interface IJiraUserData {
    accountId: string;
    displayName: string;
    emailAddress: string;
    avatarUrls: string;
    currentPerformance?: number;
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
  
  export interface IJiraIssueData {
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
      };
    };
  }
  
  export interface IGetUserIssuesResponse {
    message: string;
    statusCode: number;
    issues: IJiraIssueData[];
  }
  

  // Assuming IUser is defined in jira.interfaces.ts
export interface IUserWithPagination extends IUser {
  totalIssueHistory: number;
  currentPage: number;
  totalPages: number;
}
