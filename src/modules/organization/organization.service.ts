import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { Organization } from '../../schemas/Organization.schema';
import { OrganizationUserRole } from '../../schemas/OrganizationUserRole.schema';
import { Role } from '../../schemas/Role.schema';
import { Users } from '../../schemas/users.schema';
import { CreateOrganizationDTO } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
    @InjectModel(OrganizationUserRole.name)
    private readonly organizationUserRoleModel: Model<OrganizationUserRole>,
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
      await this.organizationUserRoleModel.create(
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

  async validateOrgAccess(userId: string, orgId: string, roles?: string[]) {
    if (!isValidObjectId(userId) || !isValidObjectId(orgId)) {
      throw new BadRequestException('Invalid userId or organizationId');
    }

    const orgUser = await this.organizationUserRoleModel
      .findOne({
        user: new Types.ObjectId(userId),
        organization: new Types.ObjectId(orgId),
        isDisabled: false,
      })
      .populate('role');

    if (!orgUser) {
      const [userExists, orgExists] = await Promise.all([
        this.usersModel.exists({ _id: userId, isDisabled: false }),
        this.organizationModel.exists({ _id: orgId, isDisabled: false }),
      ]);

      const errors = [];
      if (!userExists) {
        errors.push(`User not found (user: ${userId})`);
      }
      if (!orgExists) {
        errors.push(`Organization not found (org: ${orgId})`);
      }
      if (errors.length) {
        throw new NotFoundException(errors.join(' and '));
      }

      throw new ForbiddenException(
        `User ${userId} does not belong to organization ${orgId}`,
      );
    }

    if (roles?.length) {
      const userRole = orgUser.role?.roleName?.toLowerCase();
      const hasRole = roles.some((r) => r.toLowerCase() === userRole);
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role permissions');
      }
    }

    return orgUser;
  }

  async lastOrganization(userId: Types.ObjectId) {
    const organizationUserRole = await this.organizationUserRoleModel
      .find({ user: userId, isDisabled: false })
      .sort({ lastAccessed: -1 })
      .limit(1);
    if (!organizationUserRole || organizationUserRole.length === 0) {
      throw new NotFoundException(
        `No organization found for user with ID ${userId}`,
      );
    }
    await this.updateLastAccessed(userId, organizationUserRole[0].organization);
    return organizationUserRole[0].organization;
  }

  async updateLastAccessed(
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
  ): Promise<void> {
    if (!isValidObjectId(userId) || !isValidObjectId(organizationId)) {
      throw new BadRequestException('Invalid userId or organizationId');
    }

    const orgUser = await this.organizationUserRoleModel.findOne({
      user: userId,
      organization: organizationId,
    });

    if (!orgUser) {
      throw new NotFoundException(
        `User ${userId} does not belong to organization ${organizationId}`,
      );
    }

    orgUser.lastAccessed = new Date();
    await orgUser.save();
  }
}
