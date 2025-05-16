// dto/request-metadata.dto.ts
import { IsMongoId, IsNotEmpty, IsOptional, Matches, registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import * as moment from 'moment-timezone';

export class RequestMetadataDto {
  @IsNotEmpty({ message: 'Organization-Id is required' })
  @IsMongoId({ message: 'Invalid Organization-Id' })
  organizationId: string;

  // @IsOptional()
  // @Matches(/^[-+]\d{2}:\d{2}$/, { message: 'Invalid timezone offset format' })
  // timezoneOffset?: string;

  @IsOptional()
  @IsTimezoneRegion({ message: 'Invalid timezone region' })
  timezoneRegion?: string;
}


function IsTimezoneRegion(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isTimezoneRegion',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          return typeof value === 'string' && moment.tz.zone(value) !== null;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA timezone region`;
        },
      },
    });
  };
}