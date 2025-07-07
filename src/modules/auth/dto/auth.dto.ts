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
  @IsEmail({}, { message: 'Email is not valid' })
  emailAddress: string;

  @ApiProperty({
    description: 'The password for password-based signup. Required only if authType is "password".',
    example: 'Strong@Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required for signup.' })
  @IsStrongPassword(
    {
      minLength: 3,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
      minNumbers: 0,
    },
    {
      message:
        'Invalid password format. Your password must include at least one uppercase letter, one lowercase letter, and one special character.',
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
  @IsEmail({}, { message: 'Email is not valid' })
  emailAddress: string;
}
export class LoginUserEmailPasswordDTO {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Email is not valid' })
  emailAddress: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'Strong@Password123!',
  })
  @IsString()
  // @IsNotEmpty()
  // @IsStrongPassword(
  //   {
  //     minLowercase: 1,
  //     minUppercase: 1,
  //     minSymbols: 1,
  //   },
  //   {
  //     message:
  //       'Invalid password format.Password mustbe 8 character long and must contain minimum one uppercase,lowercase and special symbol',
  //   },
  // )
  password: string;
}

export class LoginUserEmailOnly {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Email is not valid' })
  emailAddress: string;
}
export class VerifyEmailDto {
  @ApiProperty({
    description: 'The email verification token',
    example: 'abc123xyz',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'Token should not be empty' })
  token: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'user@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email should not be empty' })
  email: string;
}

export class VerifyInviteDTO {
  @ApiProperty({
    description: 'JWT Token for invitation',
    example: 'dfdff08131089u108d01jd0j1wd',
    type: String,
  })
  jwtToken: string;
}
export class ChangeOrganization {
  @ApiProperty({
    description: 'Organization id',
    example: 'weuf2e9jf9238r4923r093ur209j',
    type: String,
  })
  organizationId: string;
}
