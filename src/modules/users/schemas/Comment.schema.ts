import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Comment extends Document {
  @Prop({ type: String, required: true })
  comment: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
