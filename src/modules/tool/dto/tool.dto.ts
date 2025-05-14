import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ToolNameDTO {
  @ApiProperty({
    description: 'Name of the tool',
    type: String,
    example: 'Jira', // Example value for toolName
  })
  @IsNotEmpty()
  @IsString()
  toolName: string;
}
