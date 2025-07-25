import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class RemoveActivitiesDto {
  @ApiProperty({
    description: 'ID of the worksheet from which to remove activities',
    example: '6614be9c7d842f4df435a8a3',
  })
  @IsMongoId()
  @IsNotEmpty()
  worksheetId: string;

  @ApiProperty({
    description: 'List of activity IDs to remove from the worksheet',
    type: [String],
    example: ['6614be9c7d842f4df435a8a4', '6614be9c7d842f4df435a8a5'],
  })
  @IsArray()
  @IsMongoId({ each: true })
  activityIds: string[];
}
