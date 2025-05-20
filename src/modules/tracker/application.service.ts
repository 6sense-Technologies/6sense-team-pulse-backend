import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Application,
  ApplicationDocument,
} from './entities/application.schema';
import { Model } from 'mongoose';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel(Application.name)
    private appModel: Model<ApplicationDocument>,
  ) {}
  private readonly logger = new Logger(ApplicationService.name);

  async findOrCreate(
    appName: string,
    icon?: string,
  ): Promise<ApplicationDocument> {
    try {
      const update: Partial<Application> = { name: appName };
      if (icon) {
        update.icon = icon;
      }

      const app = await this.appModel.findOneAndUpdate(
        { name: appName },
        { $setOnInsert: update },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!app) {
        throw new Error(`Failed to create or retrieve application: ${appName}`);
      }

      return app;
    } catch (error) {
      this.logger.error(
        `Error in ApplicationService.findOrCreate: ${error.message}`,
      );
      throw new Error(`ApplicationService.findOrCreate failed: ${error.message}`);
    }
  }


}
