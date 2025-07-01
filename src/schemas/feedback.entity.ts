import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { FeedbackTone } from 'src/modules/feedback/enums/feedbackTone.enum';
import { FeedbackType } from 'src/modules/feedback/enums/feedbackType.enum';

export type FeedbackDocument = HydratedDocument<Feedback>;

@Schema({ timestamps: true })
export class Feedback {
  @Prop({
    required: true,
    ref: 'Organization',
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  })
  organizationId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, enum: FeedbackType })
  type: FeedbackType;

  @Prop({
    required: false,
    default: [],
  })
  linkedIssues: mongoose.Schema.Types.ObjectId[];

  @Prop({ required: true, enum: FeedbackTone })
  tone: FeedbackTone;

  @Prop({ required: true })
  comment: string;

  @Prop({ default: false })
  status: boolean;

  @Prop({
    required: true,
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  })
  assignedTo: mongoose.Schema.Types.ObjectId;

  @Prop({
    required: true,
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  })
  assignedBy: mongoose.Schema.Types.ObjectId;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
