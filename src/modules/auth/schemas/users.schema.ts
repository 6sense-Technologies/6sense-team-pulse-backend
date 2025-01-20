import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Users extends Document {
  @Prop({ type: String, default: '', required: true })
  displayName: string;

  @Prop({ type: String, default: '', required: true })
  emailAddress: string;

  @Prop({ type: String, required: false })
  password: string;
}

export const UsersSchema = SchemaFactory.createForClass(Users);
