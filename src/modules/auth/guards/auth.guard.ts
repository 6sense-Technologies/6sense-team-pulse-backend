import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { isValidObjectId } from 'mongoose';
import { OrganizationService } from 'src/modules/organization/organization.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;
    // const organizationId = request.headers['organization-id'];

    if (!user || !user.userId) {
      throw new UnauthorizedException('Invalid or missing authentication');
    }

    if (!user.organizationId) {
      throw new BadRequestException('Missing "organizationId" in JWT');
    }

    if (!isValidObjectId(user.organizationId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler()) || [];

    try {
      const orgUser = await this.organizationService.validateOrgAccess(
        user.userId,
        user.organizationId,
        requiredRoles,
      );

      // Attach organizationId and userId to request for downstream use
      request.user.userId = user.userId;
      request.user.organizationId = user.organizationId;
      request.user.role = orgUser.role.roleName;

      return true;
    } catch (err) {
      // Rethrow known NestJS exceptions, wrap others
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }

      throw new UnauthorizedException('Authorization failed');
    }
  }
}
