import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class InviteUserDTO {
  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'johndoe@example.com',
  })
  @IsString()
  @IsEmail()
  emailAddress: string;

  @ApiProperty({
    description: 'The designation or job title of the user',
    example: 'Software Engineer',
  })
  @IsString()
  designation: string;

  @ApiProperty({
    description: 'List of project names the user is invited to',
    type: [String],
    example: ['Project Alpha', 'Project Beta'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one project must be selected' })
  @IsString({ each: true })
  @IsOptional()
  projects: [];

  @ApiPropertyOptional({
    description: 'Optional Jira ID associated with the user',
    example: 'JIRA-1234',
  })
  @IsOptional()
  @IsString()
  jiraId?: string;

  @ApiPropertyOptional({
    description: 'Optional Trello ID associated with the user',
    example: 'TRELLO-5678',
  })
  @IsOptional()
  @IsString()
  trelloId?: string;

  @ApiPropertyOptional({
    description: 'Optional GitHub username of the user',
    example: 'johndoe',
  })
  @IsOptional()
  @IsString()
  githubUserName?: string;

  @ApiProperty({
    description: 'The role assigned to the user',
    example: 'Admin',
  })
  @IsString()
  role: string;

  @ApiProperty({
    description: 'Profile picture of the user',
    type: 'string',
    format: 'binary',
  })
  profilePicture?: any;
}
