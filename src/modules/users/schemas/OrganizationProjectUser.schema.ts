import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from './Organization.schema';
import { Project } from './Project.schema';
import { Users } from './users.schema';


export type OrganizationProjectUserDocument = HydratedDocument<OrganizationProjectUser>;

@Schema({ timestamps: true })
export class OrganizationProjectUser {


  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organization: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Project.name, required: true })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Users.name }) // Tracks who assigned the user
  createdBy: Types.ObjectId;
}

export const OrganizationProjectUserSchema = SchemaFactory.createForClass(OrganizationProjectUser);
