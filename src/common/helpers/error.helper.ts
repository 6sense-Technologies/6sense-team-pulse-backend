import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';

export const handleError = (error: any): void => {
  if (error instanceof NotFoundException) {
    throw new NotFoundException({
      status: 404,
      errorCode: 'not_found',
      message: error.message,
      data: {},
    });
  } else if (error instanceof ConflictException) {
    throw new ConflictException({
      status: 409,
      errorCode: 'conflict',
      message: error.message,
      data: {},
    });
  } else if (error instanceof BadRequestException) {
    throw new BadRequestException({
      status: 400,
      errorCode: 'bad_request',
      message: error.message,
      data: {},
    });
  } else if (error instanceof UnauthorizedException) {
    throw new UnauthorizedException({
      status: 401,
      errorCode: 'unauthorized',
      message: error.message,
      data: {},
    });
  } else if (error instanceof ForbiddenException) {
    throw new ForbiddenException({
      status: 403,
      errorCode: 'forbidden',
      message: error.message,
      data: {},
    });
  } else {
    throw new InternalServerErrorException({
      status: 500,
      errorCode: 'internal_server_error',
      message: error.message,
      data: {},
    });
  }
};
