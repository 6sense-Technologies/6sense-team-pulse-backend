import {
  BadRequestException,
  Body,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Organization } from '../users/schemas/Organization.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Mongoose, Types } from 'mongoose';
import { CreateOrganizationDTO } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
  ) {}

  async create(createOrganizationDTO: CreateOrganizationDTO, userId: string) {
    if (
      await this.organizationModel.findOne({
        domain: createOrganizationDTO.domainName,
      })
    ) {
      throw new ConflictException(
        `Another domain name with ${createOrganizationDTO.domainName} already exists`,
      );
    }
    const organization = await this.organizationModel.create({
      organizationName: createOrganizationDTO.organizationName,
      domain: createOrganizationDTO.domainName,
      users: [new Types.ObjectId(userId)],
      createdBy: new Types.ObjectId(userId),
    });

    return organization;
  }
}
