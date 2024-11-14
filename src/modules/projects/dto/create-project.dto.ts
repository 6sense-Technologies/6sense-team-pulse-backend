import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  tool: string;

  @IsNotEmpty()
  @IsString()
  toolURL: string;

  @IsNotEmpty()
  @IsString()
  name: string;
}
