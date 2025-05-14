// decorators/request-metadata.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsMongoId, IsOptional, Matches } from 'class-validator';
import { RequestMetadataDto } from './request-metadata.dto';

// Decorator part
export const RequestMetadata = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestMetadataDto => {
    const request = ctx.switchToHttp().getRequest();
    const headers = request.headers;

    // Extract headers and map to DTO
    const metadata = plainToInstance(RequestMetadataDto, {
      organizationId: headers['organization-id'],
      timezoneOffset: headers['x-timezone-offset'],
    });

    // Validate the DTO
    const errors = validateSync(metadata, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadRequestException(errors.map(e => Object.values(e.constraints)).flat().join(', '));
    }

    return metadata;
  },
);
