import { PartialType } from '@nestjs/mapped-types';
import { CreateGoalDto } from './create-goal.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @IsNotEmpty()
  @IsString()
  status: string;
}
