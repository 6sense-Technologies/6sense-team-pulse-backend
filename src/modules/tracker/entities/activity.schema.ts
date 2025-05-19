import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { Organization } from 'src/schemas/Organization.schema';
import { Users } from 'src/schemas/users.schema';
import { Application } from './application.schema';

export type ActivityDocument = HydratedDocument<Activity>;

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Date, required: true })
  startTime: Date;

  @Prop({ type: Date, required: false })
  endTime: Date;

  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organization: Organization;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  user: Users;

  @Prop({ type: Types.ObjectId, ref: Application.name, required: true })
  application: Application;

  @Prop({ type: String, required: true })
  pid: string; //process id

  @Prop({ type: String, required: false })
  browserUrl: string; //if it is in a browser then the browser url

  @Prop({ type: String, required: false })
  faviconUrl: string; //if it is in a browser then the favicon url
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
