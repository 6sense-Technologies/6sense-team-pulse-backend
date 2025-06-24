import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Tool extends Document {
  @Prop({ type: String, default: '' })
  toolName: string;

  @Prop({ type: String, default: '' })
  toolUrl: string;

  @Prop({ type: String, default: '' })
  apiKey: string; // This is for Linear

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'ProjectTool' }],
  })
  projects: MongooseSchema.Types.ObjectId[]; // Virtual population
}

export const ToolSchema = SchemaFactory.createForClass(Tool);
