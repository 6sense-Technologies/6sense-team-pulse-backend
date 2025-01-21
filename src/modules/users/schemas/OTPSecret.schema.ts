import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class OTPSecret extends Document {
  @Prop({ required: true, unique: true })
  emailAddress: string;

  @Prop({ required: true })
  secret: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const OTPSecretSchema = SchemaFactory.createForClass(OTPSecret);