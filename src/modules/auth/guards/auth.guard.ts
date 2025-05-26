import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;
    const organizationId = request.headers['organization-id'];

    if (!user || !user.userId) {
      throw new UnauthorizedException('Invalid or missing authentication');
    }

    if (!organizationId) {
      throw new BadRequestException('Missing "organization-id" header');
    }

    if (!isValidObjectId(organizationId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    const requiredRoles =
      this.reflector.get<string[]>('roles', context.getHandler()) || [];

    try {
      const orgUser = await this.authService.validateOrgAccess(
        user.userId,
        organizationId,
        requiredRoles,
      );

      // Attach organizationId and userId to request for downstream use
      request.user.userId = user.userId;
      request.user.organizationId = organizationId;

      return true;
    } catch (err) {
      // Rethrow known NestJS exceptions, wrap others
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }

      throw new UnauthorizedException('Authorization failed');
    }
  }
}
