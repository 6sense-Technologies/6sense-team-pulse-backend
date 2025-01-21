import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  designation: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one project must be selected' })
  @IsString({ each: true }) // Each item in the array must be a string
  projects: string[];

  @IsOptional()
  @IsString()
  jiraId?: string;

  @IsOptional()
  @IsString()
  trelloId?: string;
}
