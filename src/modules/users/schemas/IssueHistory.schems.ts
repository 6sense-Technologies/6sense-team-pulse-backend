import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Issue, IssueCount, IUser } from './user.schema';

@Schema({ timestamps: true })
export class IssueHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: IUser;

  @Prop({ type: String })
  date: string;

  @Prop({
    type: {
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
    default: {},
  })
  issuesCount: {
    notDone?: IssueCount;
    done?: IssueCount;
  };

  @Prop({ type: Number, default: 0 })
  taskCompletionRate?: number;

  @Prop({ type: Number, default: 0 })
  userStoryCompletionRate?: number;

  @Prop({ type: Number, default: 0 })
  overallScore?: number;

  @Prop({ type: String, default: '' })
  comment?: string;

  @Prop({ type: Number, default: 0 })
  codeToBugRatio?: number;

  @Prop({ type: [Object], default: [] })
  notDoneIssues?: Issue[];

  @Prop({ type: [Object], default: [] })
  doneIssues?: Issue[];
}

export const IssueHistorySchema = SchemaFactory.createForClass(IssueHistory);
