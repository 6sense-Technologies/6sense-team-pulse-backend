// dto/get-project-member-worksheets-query.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Matches,
  IsMongoId,
} from 'class-validator';

export class WorksheetListOfProjectQueryDto {
  @ApiProperty({
    description: 'Project ID (required)',
    example: '6652e92f1b57c2a0d842c218',
  })
  @IsMongoId()
  @IsNotEmpty()
  'project-id': string;

  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit = 10;

  @ApiPropertyOptional({ description: 'Start date in YYYY-MM-DD format' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid start-date format. Expected YYYY-MM-DD.',
  })
  'start-date'?: string;

  @ApiPropertyOptional({ description: 'End date in YYYY-MM-DD format' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid end-date format. Expected YYYY-MM-DD.',
  })
  'end-date'?: string;

  @ApiPropertyOptional({
    enum: ['duration', 'reportedTime'],
    default: 'reportedTime',
  })
  @IsOptional()
  @IsEnum(['duration', 'reportedTime'])
  'sort-by': 'duration' | 'reportedTime' = 'reportedTime';

  @ApiPropertyOptional({ enum: ['oldest', 'latest'], default: 'latest' })
  @IsOptional()
  @IsEnum(['oldest', 'latest'])
  'sort-order': 'oldest' | 'latest' = 'latest';

  @ApiPropertyOptional({
    description: 'Search by worksheet name (partial match)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
