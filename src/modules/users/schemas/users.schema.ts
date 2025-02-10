import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Users extends Document {
  @Prop({ type: String, default: '', required: true })
  displayName: string;

  @Prop({ type: String, default: '', required: true, unique: true })
  emailAddress: string;

  @Prop({ type: String, required: false })
  password?: string;

  @Prop({ type: Boolean, required: false, default: false })
  isVerified: boolean;

  @Prop({ type: String, required: false })
  designation?: string;

  @Prop({ type: String, required: false, default: '' })
  jiraId?: string;

  @Prop({ type: String, required: false, default: '' })
  trelloId?: string;

  @Prop({ type: String, required: false, default: '' })
  githubUserName?: string;

  @Prop({ type: Boolean, required: false, default: false })
  isInvited: boolean;

  @Prop({ type: Boolean, required: false, default: false })
  isDisabled: boolean;
}

export const UsersSchema = SchemaFactory.createForClass(Users);
