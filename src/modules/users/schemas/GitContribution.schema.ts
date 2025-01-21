import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';
import { GitRepo } from './GitRepo.schema';

@Schema({ timestamps: true })
export class GitContribution extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'GitRepo' })
  gitRepo: GitRepo;

  @Prop({ type: Date, default: Date.now })
  date: Date;

  @Prop({ type: String, default: '' })
  dateString: string;

  @Prop({ type: String, default: '' })
  branch: string;

  @Prop({ type: String, default: '' })
  commitHomeUrl: string;

  @Prop({ type: Number, default: 0 })
  totalAdditions: number;

  @Prop({ type: Number, default: 0 })
  totalDeletions: number;

  @Prop({ type: Number, default: 0 })
  totalChanges: number;

  @Prop({ type: Number, default: 0 })
  totalWritten: number;
}

export const GitContributionSchema =
  SchemaFactory.createForClass(GitContribution);
