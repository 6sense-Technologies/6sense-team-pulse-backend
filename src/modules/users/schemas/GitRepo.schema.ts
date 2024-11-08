import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class GitRepo extends Document {
  @Prop({
    type: String,
    enum: ['github', 'gitlab', 'bitbucket'],
    default: 'github',
  })
  provider: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: String, default: '' })
  organization: string;

  @Prop({ type: String, default: '' })
  gitUsername: string;

  @Prop({ type: String, default: '' })
  repo: string;
}

export const GitRepoSchema = SchemaFactory.createForClass(GitRepo);
