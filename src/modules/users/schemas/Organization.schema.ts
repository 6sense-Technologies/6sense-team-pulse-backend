import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Project } from './Project.schema';
import { Users } from './users.schema';
@Schema({ timestamps: true })
export class Organization extends Document {
  @Prop({ type: String, default: '' })
  organizationName: string;

  @Prop({ type: String, default: '' })
  domain: string;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }], // Reference to the User schema
    default: [],
  })
  users: mongoose.Types.ObjectId[];

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Reference to the User schema
    default: [],
  })
  projects: mongoose.Types.ObjectId[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy: Users;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
