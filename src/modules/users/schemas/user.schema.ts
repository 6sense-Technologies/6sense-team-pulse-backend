import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum Designation {
  FrontendDeveloper = 'Frontend Developer',
  BackendDeveloper = 'Backend Developer',
  SQA = 'SQA',
  ProjectManager = 'Project Manager',
  Designer = 'Designer',
}

export enum Project {
  Pattern50 = 'Pattern 50',
  ChargeOnSite = 'Charge on Site',
}

export interface IIssueCount {
  Task: number;
  Bug: number;
  Story: number;
}

export interface IIssue {
  issueId: string;
  summary: string;
  status: string;
  issueType?: string;
  dueDate: string;
  issueLinks?: IIssueLink[];
}

export interface IIssueLink {
  issueId: string;
  issueType: string;
  summary: string;
  status: string;
}

export interface IIssueHistoryEntry {
  date: string;
  issuesCount: {
    notDone?: IIssueCount;
    done?: IIssueCount;
  };
  taskCompletionRate?: number;
  userStoryCompletionRate?: number;
  overallScore?: number;
  comment?: string;
  notDoneIssues?: IIssue[];
  doneIssues?: IIssue[];
  codeToBugRatio?: number;
  reportBug?: {
    noOfBugs: number;
    comment?: string;
  };
}

export interface IUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
  userFrom: string;
  currentPerformance: number;
  issueHistory: IIssueHistoryEntry[];
  designation: Designation;
  project: Project;
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
  userFrom: string;

  @Prop({ type: String, default: '' })
  emailAddress: string;

  @Prop({ type: String, default: '' })
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
        reportBug: {
          noOfBugs: { type: Number, default: 0 },
          comment: { type: String, default: '' },
        },
        notDoneIssues: [
          {
            issueId: { type: String },
            summary: { type: String },
            status: { type: String },
            issueType: { type: String },
            dueDate: { type: String, default: null },
            issueLinks: [
              {
                issueId: { type: String },
                issueType: { type: String },
                summary: { type: String },
                status: { type: String },
              },
            ],
          },
        ],
        doneIssues: [
          {
            issueId: { type: String },
            summary: { type: String },
            status: { type: String },
            issueType: { type: String },
            dueDate: { type: String, default: null },
            issueLinks: [
              {
                issueId: { type: String },
                issueType: { type: String },
                summary: { type: String },
                status: { type: String },
              },
            ],
          },
        ],
      },
    ],
    default: [],
  })
  issueHistory: IIssueHistoryEntry[];

  @Prop({ type: Number, default: 0 })
  currentPerformance: number;

  @Prop({ type: String, enum: Designation })
  designation: Designation;

  @Prop({ type: String, enum: Project })
  project: Project;

  @Prop({ type: Boolean, default: false })
  isArchive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
