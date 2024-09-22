import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum Designation {
  FrontendDeveloper = 'Frontend Developer',
  BackendDeveloper = 'Backend Developer',
  SQA = 'SQA',
  ProjectManager = 'Project Manager',
  Designer = 'Designer',
}

export interface IssueCount {
  Task: number;
  Bug: number;
  Story: number;
}

export interface Issue {
  issueId: string;
  summary: string;
  status: string;
  issueType: string;
  dueDate: string;
}

export interface IssueHistoryEntry {
  date: string;
  issuesCount: {
    notDone?: IssueCount;
    done?: IssueCount;
  };
  taskCompletionRate?: number;
  userStoryCompletionRate?: number;
  overallScore?: number;
  comment?: string;
  notDoneIssues?: Issue[];
  doneIssues?: Issue[];
  codeToBugRatio?: number;
}

export interface IUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
  currentPerformance: number;
  issueHistory: IssueHistoryEntry[];
  designation: Designation;
  isArchive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop()
  accountId: string;

  @Prop()
  displayName: string;

  @Prop()
  emailAddress: string;

  @Prop({ type: String })
  avatarUrls: string;

  @Prop({
    type: [
      {
        date: { type: String },
        issuesCount: {
          notDone: {
            Task: { type: Number, default: 0 },
            Bug: { type: Number, default: 0 },
            Story: { type: Number, default: 0 },
          },
          done: {
            Task: { type: Number, default: 0 },
            Bug: { type: Number, default: 0 },
            Story: { type: Number, default: 0 },
          },
        },
        taskCompletionRate: { type: Number, default: 0 },
        userStoryCompletionRate: { type: Number, default: 0 },
        overallScore: { type: Number, default: 0 },
        comment: { type: String, default: '' },
        codeToBugRatio: { type: Number, default: 0 },
        notDoneIssues: [
          {
            issueId: { type: String },
            summary: { type: String },
            status: { type: String },
            issueType: { type: String },
            dueDate: { type: String, default: null },
          },
        ],
        doneIssues: [
          {
            issueId: { type: String },
            summary: { type: String },
            status: { type: String },
            issueType: { type: String },
            dueDate: { type: String, default: null },
          },
        ],
      },
    ],
    default: [],
  })
  issueHistory: IssueHistoryEntry[];

  @Prop({ type: Number, default: 0 })
  currentPerformance: number;

  @Prop({ type: String, enum: Designation })
  designation: Designation;

  @Prop({ type: Boolean, default: false })
  isArchive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
