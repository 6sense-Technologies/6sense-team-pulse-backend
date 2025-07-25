import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RolePermission extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Role', required: true })
  role: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Permission',
    required: true,
  })
  permission: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}
export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission);
