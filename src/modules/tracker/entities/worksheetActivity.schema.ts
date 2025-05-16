import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { Activity } from './activity.schema';
import { Worksheet } from './worksheet.schema';

export type WorksheetActivityDocument =
  HydratedDocument<WorksheetActivity>;

@Schema({ timestamps: true })
export class WorksheetActivity {
  @Prop({ type: Types.ObjectId, ref: Activity.name, required: true, unique: true }) //remove unique constraint if we want to allow acitivity to be added multiple times to multiple worksheets
  activity: Activity;

  @Prop({ type: Types.ObjectId, ref: Worksheet.name, required: true })
  worksheet: Worksheet;
}

export const WorksheetActivitySchema =
  SchemaFactory.createForClass(WorksheetActivity);
