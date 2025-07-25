import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { AccessTokenGuard } from '../guards/accessToken.guard';
import { AuthGuard } from '../guards/auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

export const Auth = (roles: string[] = []) => {
  const ROLES_KEY = 'roles';
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(AccessTokenGuard, AuthGuard),
    ApiBearerAuth(),
  );
};
