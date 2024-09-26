import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface IssueEntry {
  serialNumber?: number;
  issueType: string;
  issueId: string;
  issueStatus: string;
  planned?: boolean;
  checked?: boolean;
  link?: number;
}

@Schema({ timestamps: true })
export class IssueHistory extends Document {
  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  accountId: string;

  @Prop({
    type: [{
      date: { type: String },
      issues: {
        type: [{
          serialNumber: { type: Number, required: true },
          issueType: { type: String, required: true },
          issueId: { type: String, required: true },
          issueStatus: { type: String, required: true },
          planned: { type: Boolean, default: false },
          checked: { type: Boolean, default: false },
          link: { type: Number, default: 0 },
        }]
      }
    }]
  })
  history: { date: string; issues: IssueEntry[] }[];
}

export const IssueHistorySchema = SchemaFactory.createForClass(IssueHistory);
