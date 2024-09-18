import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface IssueCount {
  Task: number;
  Bug: number;
  Story: number;
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
}

export interface IUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: string;
  currentPerformance: number;
  issueHistory: IssueHistoryEntry[];
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
      },
    ],
    default: [],
  })
  issueHistory: IssueHistoryEntry[];

  @Prop({ type: Number, default: 0 })
  currentPerformance: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
