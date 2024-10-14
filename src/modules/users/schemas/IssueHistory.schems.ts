import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema()
class Comment {
  @Prop({ type: String, required: true })
  comment: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

@Schema()
class IssueEntry {
  @Prop({ type: Number })
  serialNumber?: number;

  @Prop({ type: String, required: true })
  issueType: string;

  @Prop({ type: String, required: true })
  issueId: string;

  @Prop({ type: String, required: true })
  issueSummary?: string;

  @Prop({ type: String, required: true })
  issueStatus: string;

  @Prop({ type: Boolean, default: false })
  planned?: boolean;

  @Prop({ type: String, default: '' })
  link?: string;
}

export const IssueEntrySchema = SchemaFactory.createForClass(IssueEntry);

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
