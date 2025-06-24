import { IsString, IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
