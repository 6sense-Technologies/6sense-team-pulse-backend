import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty, IsString, Matches } from 'class-validator';

export class AssignActivitiesDto {
  @ApiProperty({
    description: 'ID of the project the worksheet belongs to',
    example: '6614be9c7d842f4df435a8a3',
  })
  @IsMongoId()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Unique name of the worksheet (per user, org, and project)',
    example: 'May 8 – Analysis Tasks',
  })
  @IsString()
  @IsNotEmpty()
  worksheetName: string;

  @ApiProperty({
    description: 'Date of the worksheet in YYYY-MM-DD format',
    example: '2023-05-08',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @ApiProperty({
    description: 'List of activity IDs to assign to the worksheet',
    type: [String],
    example: ['6614be9c7d842f4df435a8a4', '6614be9c7d842f4df435a8a5'],
  })
  @IsArray()
  @IsMongoId({ each: true })
  activityIds: string[];
}
