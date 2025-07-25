import mongoose from 'mongoose';
import { FeedbackTone } from '../enums/feedbackTone.enum';
import { FeedbackType } from '../enums/feedbackType.enum';

export interface IFeedback {
  organization: string;
  type: FeedbackType;
  tone: FeedbackTone;
  linkedIssues: string[] | mongoose.Schema.Types.ObjectId[];
  comment: string;
  status: string;
  assignedTo: string;
  assignedBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
