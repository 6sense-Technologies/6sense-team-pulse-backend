import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDTO {
  @ApiProperty({
    description: 'The name of the organization',
    example: 'Acme Corporation',
  })
  @IsString()
  @IsNotEmpty({ message: 'Organization name must not be empty' })
  @Length(2, 50, {
    message: 'Organization name must be between 2 and 50 characters',
  })
  organizationName: string;

  @ApiProperty({
    description:
      'The name associated with the organization. Must not be a domain or contain invalid characters, and cannot start with a hyphen or underscore.',
    example: 'acme_team',
  })
  @IsString()
  @IsNotEmpty({ message: 'domainName must not be empty' })
  @Matches(/^[a-z0-9]+$/, {
    message: 'domainName can only contain lower case alphabets and numbers.',
  })
  domainName: string;
}
