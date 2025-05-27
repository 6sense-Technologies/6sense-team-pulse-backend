import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class CreateManualActivityDto {
  @ApiProperty({
    example: 'Discussed new app features with team',
    description: 'Title or short description of the manual activity',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Brainstorming',
    description: 'Type of manual activity',
    enum: ALLOWED_MANUAL_TYPES,
  })
  @IsString()
  @IsIn(ALLOWED_MANUAL_TYPES)
  manualType: string;

  @ApiProperty({
    example: '2025-05-22T09:00:00Z',
    description: 'Start time of the activity (ISO 8601 format)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2025-05-22T10:30:00Z',
    description: 'End time of the activity (ISO 8601 format)',
  })
  @IsDateString()
  endTime: string;
}
