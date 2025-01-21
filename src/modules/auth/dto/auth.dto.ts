import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsEmail,
  IsIn,
  IsStrongPassword,
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
  @IsEmail({},{message: 'Email is not valid'})
  emailAddress: string;

  @ApiProperty({
    description:
      'The password for password-based signup. Required only if authType is "password".',
    example: 'Strong@Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required for signup.' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
    },
    {
      message:
        'Invalid password format.Password mustbe 8 character long and must contain minimum one uppercase,lowercase and special symbol',
    },
  )
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
  @IsEmail({},{message: 'Email is not valid'})
  emailAddress: string;
}
export class LoginUserEmailPasswordDTO {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail({},{message: 'Email is not valid'})
  emailAddress: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'Strong@Password123!',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
    },
    {
      message:
        'Invalid password format.Password mustbe 8 character long and must contain minimum one uppercase,lowercase and special symbol',
    },
  )
  password: string;
}

export class LoginUserEmailOnly {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail({},{message: 'Email is not valid'})
  emailAddress: string;
}
