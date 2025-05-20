// dto/get-worksheet-names.query.ts
import {
  IsNotEmpty,
  IsString,
  Length,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
// import { Transform } from 'class-transformer';

export class WorksheetGetNamesQueryDto {
  @ApiProperty({ name: 'project-id', required: true })
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  'project-id': string;

  @ApiProperty({ required: true, minLength: 3 })
  @IsString()
  @Length(3)
  name: string;

  @ApiProperty({ required: true })
  @IsDateString()
  date: string;
}
