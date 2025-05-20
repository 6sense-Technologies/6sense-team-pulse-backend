import {
  BadRequestException,
  Body,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organization } from '../../schemas/Organization.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, isValidObjectId, Model, Mongoose, Types } from 'mongoose';
import { CreateOrganizationDTO } from './dto/organization.dto';
import { Users } from '../../schemas/users.schema';
import { OrganizationUserRole } from '../../schemas/OrganizationUserRole.schema';
import { Role } from '../../schemas/Role.schema';
import { InjectConnection } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';

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

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const user = await this.usersModel
        .findOne({ _id: userId })
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
        role = await this.roleModel.create(
          [{ roleName: 'admin', createdBy: user }],
          {
            session,
          },
        );
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
  async findRoles() {
    const roles = await this.roleModel.find({});
    return roles;
  }

  // This is a function to verify if the user is part of the organization or not
  async verifyUserofOrg(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationUserRole> {
    try {
      if (!isValidObjectId(organizationId) || !isValidObjectId(userId)) {
        throw new BadRequestException(
          'Invalid organizationId or userId format',
        );
      }

      const orgUser = await this.organizationUserRole
        .findOne({
          organization: new Types.ObjectId(organizationId),
          user: new Types.ObjectId(userId),
        })
        .populate('user')
        .populate('organization')
        .populate('role');

      if (orgUser) {
        return orgUser;
      }

      const [userExists, orgExists] = await Promise.all([
        this.usersModel.exists({ _id: userId }),
        this.organizationModel.exists({ _id: organizationId }),
      ]);

      const errors = [];
      if (!userExists) errors.push(`User with id ${userId} does not exist`);
      if (!orgExists)
        errors.push(`Organization with id ${organizationId} does not exist`);

      if (errors.length > 0) {
        throw new NotFoundException(errors.join(' and '));
      }

      throw new BadRequestException(
        `User with id ${userId} is not part of the organization with id ${organizationId}`,
      );
    } catch (error) {
      // Optional: log or re-throw with more context
      throw error;
    }
  }
}
