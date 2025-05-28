import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { Project } from '../../../schemas/Project.schema';
import { Organization } from 'src/schemas/Organization.schema';
import { Users } from 'src/schemas/users.schema';

export type WorksheetDocument = HydratedDocument<Worksheet>;

@Schema({ timestamps: true })
export class Worksheet {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: Project.name, required: true })
  organization: Organization;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  user: Users;

  @Prop({ type: Types.ObjectId, ref: Project.name, required: true })
  project: Project;

  @Prop({ type: String, required: true }) // format: 'YYYY-MM-DD'
  date: string;

  @Prop({ type: Date, required: true, default: Date.now })
  lastReportedOn: Date;
}

export const WorksheetSchema = SchemaFactory.createForClass(Worksheet);

WorksheetSchema.index(
  { name: 1, user: 1, organization: 1, project: 1, date: 1 },
  { unique: true },
);
