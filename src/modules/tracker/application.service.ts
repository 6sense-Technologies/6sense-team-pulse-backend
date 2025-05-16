import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Application, ApplicationDocument } from "./entities/application.schema";
import { Model } from "mongoose";

@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel(Application.name)
    private appModel: Model<ApplicationDocument>
  ) {}

  async findOrCreate(appName: string, icon?: string): Promise<ApplicationDocument> {
    let app = await this.appModel.findOne({ name: appName });
    if (!app) {
      app = await this.appModel.create({ name: appName });
    }
    return app;
  }
}
