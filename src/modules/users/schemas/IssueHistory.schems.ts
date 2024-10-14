import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { IssueEntry } from './IssueEntry.schema';
import { Comment } from './Comment.schema';

@Schema({ timestamps: true })
export class IssueHistory extends Document {
  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  accountId: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  history: {
    [date: string]: {
      issues: IssueEntry[];
      noOfBugs: number;
      comment: string;
      comments: Comment[];
    };
  };
}

export const IssueHistorySchema = SchemaFactory.createForClass(IssueHistory);
