import { IsNotEmpty, IsString } from 'class-validator';
export class CreateGoalActionDto {
  @IsNotEmpty()
  @IsString()
  goal: string;

  @IsNotEmpty()
  @IsString()
  action: string;
}
