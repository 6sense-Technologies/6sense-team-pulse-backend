import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsEmail,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDTO {
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
  @ValidateIf((o) => o.authType === 'password')
  @IsNotEmpty({ message: 'Password is required for password-based signup.' })
  @IsOptional()
  password?: string;

  @ApiProperty({
    description: 'The type of authentication to use for the user.',
    example: 'password',
    enum: ['password', 'passwordless'], // This generates Swagger documentation with the allowed values.
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['password', 'passwordless'], {
    message: 'authType must be either "password" or "passwordless".',
  }) // Enforces that authType must be one of these two values.
  authType: 'password' | 'passwordless';
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


export class LoginUserEmailOnly{
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;
}