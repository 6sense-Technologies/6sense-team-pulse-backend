import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Project } from './Project.schema'
import { Tool } from './Tool.schema'

@Schema({ timestamps: true })
export class ProjectTool extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true })
  project: Project;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tool', required: true })
  tool: Tool;

}

export const ProjectToolSchema = SchemaFactory.createForClass(ProjectTool);
