import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class Goal extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: String, default: '' })
  goalItem: string;

  @Prop({
    type: String,
    enum: ['To Do', 'In Progress', 'Done'],
    default: 'To Do',
  })
  status: string;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);
