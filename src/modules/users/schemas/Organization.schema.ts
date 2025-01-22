import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Users } from './users.schema';
import { Project } from './Project.schema'
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
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
