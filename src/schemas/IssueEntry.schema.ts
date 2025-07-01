import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class IssueEntry extends Document {
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

  @Prop({ required: false })
  link: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  accountId: string;

  @Prop({ required: true, default: '' })
  projectUrl: string;

  @Prop({ required: false, default: '' })
  issueIdUrl: string;

  @Prop({ required: false, default: '' })
  issueCode: string;

  @Prop({ required: false, default: '' })
  issueLinkUrl: string;

  @Prop({
    type: [String],
    required: false,
    default: [],
  })
  linkedIssues: string[];

  @Prop({ type: Types.ObjectId, required: false })
  user: Types.ObjectId;

  @Prop({ default: '' })
  comment: string;
}

export const IssueEntrySchema = SchemaFactory.createForClass(IssueEntry);
