import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString
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
    type: 'string',
    example: '["Project Alpha", "Project Beta"]', // Send as a JSON string
  })
  @IsArray()
  @IsOptional()
  @Transform(({ value }) => {
    try {
      const values = value.split(','); //split to array
      console.log(values);
      return values;
    } catch (e) {
      throw new Error('Invalid JSON format for projects');
    }
  })
  projects: string[];

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
  @IsOptional()
  profilePicture?: any;
}
