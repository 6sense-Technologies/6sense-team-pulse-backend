import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ToolDto {
  @ApiProperty({
    description: 'Name of the tool',
    type: String,
    example: 'VSCode', // Example value for toolName
  })
  @IsNotEmpty()
  @IsString()
  toolName: string;

  @ApiProperty({
    description: 'URL for the tool',
    type: String,
    example: 'https://code.visualstudio.com/', // Example value for toolUrl
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  toolUrl: string;

  @ApiProperty({
    description: 'API Key for the tool (This is for Linear)',
    type: String,
    example: 'xxx_xxx_jvvvLaaa8ZAaaaabpOBbbbyRwbbbRGQcccgRcccx', // Example value for apiKey
    required: false,
  })
  @IsString()
  apiKey?: string; // Optional field for API key

  @ApiProperty({
    description: "Project ID associated with the tool (this is for Linear)",
    type: String,
    example: '4daaaa4b-aaaa-aaaa-aaaa-aaadcbbf4aaa', // Example value for projectId
    required: false,
  })
  @IsString()
  projectId?: string; // Optional field for project ID
}

export class CreateProjectDto {
  @ApiProperty({
    description: 'Name of the project',
    type: String,
    example: 'My Awesome Project', // Example value for project name
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
        toolUrl: 'https://code.visualstudio.com/',
      },
      {
        toolName: 'GitHub',
        toolUrl: 'https://github.com/',
      },
    ], // Example value for tools array
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true }) // Validate each object in the array
  @Type(() => ToolDto) // Transform array items into ToolDto instances
  tools: ToolDto[];
}
