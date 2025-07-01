import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { FeedbackTone } from '../enums/feedbackTone.enum';
import { FeedbackType } from '../enums/feedbackType.enum';

export class CreateFeedbackDto {
  @IsNotEmpty()
  @IsString()
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsNotEmpty()
  @IsString()
  @IsEnum(FeedbackTone)
  tone: FeedbackTone;

  @IsOptional()
  @IsArray()
  @ValidateIf((o) => o.type === FeedbackType.BUG)
  @IsMongoId({ each: true })
  linkedIssues: string[];

  @IsNotEmpty()
  @IsString()
  comment: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'Assigned to is not valid' })
  assignedTo: string;
}
