import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({
    type: String,
    enum: ['jira', 'trello'],
    default: 'jira',
  })
  tool: string;

  @Prop({ type: String, default: '' })
  toolURL: string;

  @Prop({ type: String, default: '' })
  name: string;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
