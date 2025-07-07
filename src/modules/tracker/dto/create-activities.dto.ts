import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsUrl,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const ISO8601_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class ActivityLogEntryDto {
  @ApiProperty({ example: 'Safari' })
  @IsString()
  @IsNotEmpty()
  app_name: string;

  @ApiProperty({ example: '/Applications/Google Chrome.app', required: false })
  @IsString()
  @IsOptional()
  app_path?: string;

  @ApiProperty({ example: 81614 })
  @IsNumber()
  pid: number;

  @ApiProperty({
    example: 'https://www.applegadgetsbd.com/product/macbook-air-m1-8256gb-13-inch-gold',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  browser_url?: string;

  @ApiProperty({
    example: 'MacBook Air M1 Gold Price in Bangladesh',
    required: false,
  })
  @IsString()
  @IsOptional()
  window_title?: string;

  @ApiProperty({
    example: 'https://www.google.com/s2/favicons?sz=64&domain=www.applegadgetsbd.com',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  favicon_url?: string;

  @ApiProperty({ example: 'focused' })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({ example: '2025-04-18T19:11:44Z' })
  @Matches(ISO8601_DATETIME_REGEX, {
    message: 'timestamp must be a full ISO 8601 datetime string (with time)',
  })
  timestamp: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  duration_sec?: number;
}

export class CreateActivitiesDto {
  @ApiProperty({ example: 'abc', description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organization_id: string;

  @ApiProperty({
    description: 'Activity log entries',
    type: [ActivityLogEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityLogEntryDto)
  activity_log: ActivityLogEntryDto[];
}
