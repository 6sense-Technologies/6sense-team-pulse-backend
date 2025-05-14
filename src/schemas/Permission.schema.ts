import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Permission extends Document {
  @Prop({ type: String, required: true })
  permissionName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: MongooseSchema.Types.ObjectId
}
export const PermissionSchema = SchemaFactory.createForClass(Permission);