import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Users } from './users.schema';
@Schema({ timestamps: true })
export class Role extends Document {
  @Prop({ type: String, required: true })
  roleName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Users' })
  createdBy: Users;
}
export const RoleSchema = SchemaFactory.createForClass(Role);
