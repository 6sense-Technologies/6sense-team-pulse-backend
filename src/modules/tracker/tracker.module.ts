import { Module } from '@nestjs/common';
// import { TrackerService } from './tracker.service';
import { ActivityService } from './activity.service';
import { TrackerController } from './tracker.controller';
import { Activity, ActivitySchema } from './entities/activity.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLogsProcessor } from './activity-logs.processor';
import { Application, ApplicationSchema } from './entities/application.schema';
import { BullModule } from '@nestjs/bullmq';
import { OrganizationModule } from '../organization/organization.module';
import { ApplicationService } from './application.service';
import { TimelogController } from './timelog.controller';
import { WorksheetService } from './worksheet.service';
import { Worksheet, WorksheetSchema } from './entities/worksheet.schema';
import {
  WorksheetActivity,
  WorksheetActivitySchema,
} from './entities/worksheetActivity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: Application.name, schema: ApplicationSchema }, // Assuming Application is also an Activity for this example
      { name: Worksheet.name, schema: WorksheetSchema }, // Assuming Worksheet is also an Activity for this example
      { name: WorksheetActivity.name, schema: WorksheetActivitySchema }, // Assuming WorksheetActivity is also an Activity for this example
    ]),
    BullModule.registerQueue({ name: 'activity-log' }),
    OrganizationModule, // Assuming you have an organization module to import
  ],
  controllers: [TrackerController, TimelogController],
  providers: [
    ActivityService,
    ApplicationService,
    WorksheetService,
    ActivityLogsProcessor,
  ],
  exports: [ActivityService, WorksheetService],
})
export class TrackerModule {}
