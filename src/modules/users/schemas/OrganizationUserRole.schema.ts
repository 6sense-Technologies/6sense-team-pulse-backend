import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Organization } from './Organization.schema';
import { Role } from './Role.schema';
import { Users } from './users.schema';

export type OrganizationUserRoleDocument =
  HydratedDocument<OrganizationUserRole>;

@Schema({ timestamps: true })
export class OrganizationUserRole {
  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organization: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Role.name, required: true })
  role: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name }) // Tracks who assigned the user
  createdBy: Types.ObjectId;
}

export const OrganizationUserRoleSchema =
  SchemaFactory.createForClass(OrganizationUserRole);
