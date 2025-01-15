import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class IssueEntry extends Document {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop({ required: true })
  serialNumber: number;

  @Prop({ required: true })
  issueType: string;

  @Prop({ required: true })
  issueId: string;

  @Prop({ required: true })
  issueSummary: string;

  @Prop({ required: true })
  issueStatus: string;

  @Prop({ required: true })
  planned: boolean;

  @Prop({ required: true })
  link: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  accountId: string;

  @Prop({ type: Types.ObjectId, required: true })
  user: Types.ObjectId;

  @Prop()
  comment: string;
}

export const IssueEntrySchema = SchemaFactory.createForClass(IssueEntry);
