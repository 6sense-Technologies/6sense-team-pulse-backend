import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class IssueEntry extends Document {
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
