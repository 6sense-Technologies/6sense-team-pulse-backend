import {
  IsString,
  IsIn,
  IsDateString,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ALLOWED_MANUAL_TYPES = [
  'Brainstorming',
  'Code Review',
  'Collaboration',
  'Designing',
  'Documentation',
  'Emailing',
  'Meeting',
  'Planning',
  'Presentation',
  'Researching',
  'Testing',
  'Writing',
];

export class UpdateManualActivityDto {
  @ApiPropertyOptional({
    example: 'Discussed new app features with team',
    description: 'Title or short description of the manual activity',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Brainstorming',
    description: 'Type of manual activity',
    enum: ALLOWED_MANUAL_TYPES,
  })
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_MANUAL_TYPES, {
    message: `manualType must be one of: ${ALLOWED_MANUAL_TYPES.join(', ')}`,
  })
  manualType?: string;

  @ApiPropertyOptional({
    example: '2025-05-22T09:00:00Z',
    description: 'Start time of the activity (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startTime must be a valid ISO 8601 string' })
  startTime?: string;

  @ApiPropertyOptional({
    example: '2025-05-22T10:30:00Z',
    description: 'End time of the activity (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endTime must be a valid ISO 8601 string' })
  endTime?: string;
}
