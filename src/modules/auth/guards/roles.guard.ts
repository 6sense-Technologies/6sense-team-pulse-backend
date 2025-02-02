import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { OrganizationProjectUser } from '../../users/schemas/OrganizationProjectUser.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrganizationUserRole } from '../../users/schemas/OrganizationUserRole.schema';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(OrganizationProjectUser.name)
    private readonly OrganizationProjectUser: Model<OrganizationProjectUser>,
    @InjectModel(OrganizationUserRole.name)
    private readonly OrganizationUserRole: Model<OrganizationUserRole>,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    // return true;
    const request = context.switchToHttp().getRequest();
    console.log(request);
    const jwtToken = request['headers']['authorization'].split('Bearer ')[1];
    const projectId = request['url'].split('/')[2];

    console.log(`TOKEN: ${jwtToken}`);
    console.log(`Project Id: ${projectId}`);
    const decodedToken = this.jwtService.decode(jwtToken);
    const userId = decodedToken.userId;
    console.log(`USER ID: ${userId}`);
    const result = await this.OrganizationProjectUser.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          project: new Types.ObjectId(projectId),
        },
      },
      {
        $lookup: {
          from: 'organizationuserroles', // Collection name in MongoDB (make sure it's correct)
          localField: 'organization',
          foreignField: 'organization',
          as: 'userRoles',
        },
      },
      {
        $unwind: '$userRoles',
      },
      {
        $match: {
          'userRoles.user': new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'roles', // Collection name in MongoDB
          localField: 'userRoles.role',
          foreignField: '_id',
          as: 'roleDetails',
        },
      },
      {
        $unwind: '$roleDetails',
      },
      {
        $project: {
          _id: 0,
          roleName: '$roleDetails.roleName',
        },
      },
    ]);
    // console.log('RESULT: ');
    // console.log(result[0]);
    if (result.length === 0) {
      return false;
    }
    if (result[0]?.roleName === 'admin') {
      return true;
    } else {
      return false;
    }
  }
}
