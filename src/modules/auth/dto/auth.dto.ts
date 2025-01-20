import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsEmail,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserEmailPasswordDTO {
  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;

  @ApiPropertyOptional({
    description:
      'The password for password-based signup. Required only if authType is "password".',
    example: 'StrongPassword123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required for signup.' })
  password: string;
}
export class CreateUserEmail {
  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;
}
export class LoginUserEmailPasswordDTO {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'yourPassword123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class LoginUserEmailOnly {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;
}
