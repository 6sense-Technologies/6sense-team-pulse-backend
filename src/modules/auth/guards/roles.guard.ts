import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrganizationProjectUser } from '../../users/schemas/OrganizationProjectUser.schema';
import { OrganizationUserRole } from '../../users/schemas/OrganizationUserRole.schema';
import { Roles } from '../decorators/roles.decorator';

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
    //Note: right now whatever organization user created for the first time will be auto selected this will update in future
    const roles = this.reflector.get(Roles, context.getHandler());
    // console.log(`Allowed roles: ${roles}`);
    const request = context.switchToHttp().getRequest();
    if (!request['headers']['authorization']) {
      throw new UnauthorizedException();
    }
    const jwtToken = request['headers']['authorization'].split('Bearer ')[1];
    // console.log(`TOKEN: ${jwtToken}`);
    const decodedToken = this.jwtService.decode(jwtToken);
    const userId = decodedToken.userId;
    const orgRole = await this.OrganizationUserRole.findOne({
      user: new Types.ObjectId(userId),
    })
      .populate('role')
      .populate('organization');
    for (let i = 0; i < roles.length; i += 1) {
      if (roles[i].toLowerCase() === orgRole['role']['roleName']) {
        // console.log(`Found Role: ${roles[i]}`);
        // console.log(
        //   `Found Organization ${orgRole['organization']['organizationName']}`,
        // );
        return true;
      }
    }
    return false;
  }
}
