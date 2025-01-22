import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ToolDto {
  @ApiProperty({
    description: 'Name of the tool',
    type: String,
    example: 'VSCode',  // Example value for toolName
  })
  @IsNotEmpty()
  @IsString()
  toolName: string;

  @ApiProperty({
    description: 'URL for the tool',
    type: String,
    example: 'https://code.visualstudio.com/',  // Example value for toolUrl
  })
  @IsNotEmpty()
  @IsString()
  toolUrl: string;
}

export class CreateProjectDto {
  @ApiProperty({
    description: 'Name of the project',
    type: String,
    example: 'My Awesome Project',  // Example value for project name
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Array of tools used in the project',
    type: [ToolDto],
    example: [
      {
        toolName: 'VSCode',
        toolUrl: 'https://code.visualstudio.com/'
      },
      {
        toolName: 'GitHub',
        toolUrl: 'https://github.com/'
      }
    ],  // Example value for tools array
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true }) // Validate each object in the array
  @Type(() => ToolDto) // Transform array items into ToolDto instances
  tools: ToolDto[];
}
