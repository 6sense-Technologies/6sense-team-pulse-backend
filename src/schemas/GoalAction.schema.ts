import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Goal } from '../modules/goals/entities/goal.entity';
@Schema({ timestamps: true })
export class GoalAction extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Goal' })
  goal: Goal;

  @Prop({ type: String, default: '' })
  action: string;
}

export const GoalActionSchema = SchemaFactory.createForClass(GoalAction);
