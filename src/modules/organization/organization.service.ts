import {
  BadRequestException,
  Body,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Organization } from '../users/schemas/Organization.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Mongoose, Types } from 'mongoose';
import { CreateOrganizationDTO } from './dto/organization.dto';
import { Users } from '../users/schemas/users.schema';
import { OrganizationUserRole } from '../users/schemas/OrganizationUserRole.schema';
import { Role } from '../users/schemas/Role.schema';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
    @InjectModel(OrganizationUserRole.name)
    private readonly organizationUserRole: Model<OrganizationUserRole>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
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

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const user = await this.usersModel
        .findOne({ emailAddress: userEmail })
        .session(session);

      const organization = await this.organizationModel.create(
        [
          {
            organizationName: createOrganizationDTO.organizationName,
            domain: createOrganizationDTO.domainName,
            users: [user],
            createdBy: user,
          },
        ],
        { session },
      );

      let role: any = await this.roleModel
        .findOne({ roleName: 'admin' })
        .session(session);
      if (!role) {
        role = await this.roleModel.create([{ roleName: 'admin' }], {
          session,
        });
      }

      await this.organizationUserRole.create(
        [
          {
            organization: organization[0],
            user: user,
            role: role[0] || role,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return organization[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}
