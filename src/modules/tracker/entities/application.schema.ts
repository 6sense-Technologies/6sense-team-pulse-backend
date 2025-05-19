import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

export type ApplicationDocument = HydratedDocument<Application>;

@Schema({ timestamps: true })
export class Application {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: String, required: false })
  icon: string; // base64 string
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);
