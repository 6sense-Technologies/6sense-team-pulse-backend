import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({ type: String, default: '' })
  name: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'ProjectTool' }],
  })
  tools: MongooseSchema.Types.ObjectId[]; // Virtual population

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy: User;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }], // Reference to the User schema
    default: [],
  })
  assignedUsers: mongoose.Types.ObjectId[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
