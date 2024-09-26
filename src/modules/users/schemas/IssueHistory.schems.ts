import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

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

  @Prop({ type: Boolean, default: false })
  checked?: boolean;

  @Prop({ type: Number, default: 0 })
  link?: number;
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
    };
  };
}

export const IssueHistorySchema = SchemaFactory.createForClass(IssueHistory);
