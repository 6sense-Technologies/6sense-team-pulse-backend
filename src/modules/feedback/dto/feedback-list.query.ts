import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsIn, IsDateString } from 'class-validator';

export class FeedbackListQuery {
  @ApiPropertyOptional({ type: Number, example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['latest', 'oldest'], example: 'latest', default: 'latest' })
  @IsOptional()
  @IsIn(['latest', 'oldest'])
  sort?: 'latest' | 'oldest' = 'latest';

  @ApiPropertyOptional({ type: String || Date, format: 'YYYY-MM-DDTHH:mm:ssZ', example: '' })
  @IsOptional()
  @IsDateString()
  startDate?: string | Date;

  @ApiPropertyOptional({ type: String || Date, format: 'YYYY-MM-DDTHH:mm:ssZ', example: '' })
  @IsOptional()
  @IsDateString()
  endDate?: string | Date;

  @ApiPropertyOptional({ enum: ['sent', 'received', 'both'], example: '' })
  @IsOptional()
  @IsIn(['sent', 'received', 'both'])
  direction?: 'sent' | 'received' | 'both';
}
