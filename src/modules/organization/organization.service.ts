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
import { Users } from '../users/schemas/users.schema';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
  ) {}

  async create(
    createOrganizationDTO: CreateOrganizationDTO,
    userEmail: string,
  ) {
    if (
      await this.organizationModel.findOne({
        domain: createOrganizationDTO.domainName,
      })
    ) {
      throw new ConflictException(
        `Another domain name with ${createOrganizationDTO.domainName} already exists`,
      );
    }
    const user = await this.usersModel.findOne({ emailAddress: userEmail });
    const organization = await this.organizationModel.create({
      organizationName: createOrganizationDTO.organizationName,
      domain: createOrganizationDTO.domainName,
      users: [user],
      createdBy: user,
    });

    return organization;
  }
}
