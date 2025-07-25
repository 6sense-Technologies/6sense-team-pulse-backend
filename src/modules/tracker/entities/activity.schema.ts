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

  @Prop({ type: Date, required: true })
  endTime: Date;

  @Prop({ type: Types.ObjectId, ref: Organization.name, required: true })
  organization: Organization;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  user: Users;

  @Prop({ type: Types.ObjectId, ref: Application.name })
  application: Application;

  @Prop({ type: String })
  pid: string; //process id

  @Prop({ type: String, required: false })
  browserUrl: string; //if it is in a browser then the browser url

  @Prop({ type: String, required: false })
  faviconUrl: string; //if it is in a browser then the favicon url

  @Prop({ type: String })
  manualType?: string;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.pre<Activity>('save', function (next) {
  const isManual = !!this.manualType;

  if (isManual) {
    if (this.application || this.pid || this.browserUrl || this.faviconUrl) {
      return next(
        new Error(
          'Manual activities must not contain application, pid, browserUrl, or faviconUrl.',
        ),
      );
    }
  } else {
    if (!this.application || !this.pid) {
      return next(new Error('Automatic activities must contain application and pid.'));
    }
  }

  next();
});
