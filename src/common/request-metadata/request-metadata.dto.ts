// dto/request-metadata.dto.ts
import { IsMongoId, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class RequestMetadataDto {
  @IsNotEmpty({ message: 'Organization-Id is required' })
  @IsMongoId({ message: 'Invalid Organization-Id' })
  organizationId: string;

  @IsOptional()
  @Matches(/^[-+]\d{2}:\d{2}$/, { message: 'Invalid timezone offset format' })
  timezoneOffset?: string;
}
