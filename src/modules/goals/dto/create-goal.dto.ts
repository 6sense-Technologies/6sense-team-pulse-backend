import { IsNotEmpty, IsString } from 'class-validator';
export class CreateGoalDto {
  @IsNotEmpty()
  @IsString()
  goal: string;

  @IsNotEmpty()
  @IsString()
  user: string;
}
