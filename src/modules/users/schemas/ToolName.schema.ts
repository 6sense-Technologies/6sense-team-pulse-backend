import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class ToolName extends Document {
  @Prop({ type: String, default: '' })
  toolName: string;
}

export const ToolNameSchema = SchemaFactory.createForClass(ToolName);
