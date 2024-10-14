import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IJiraErrorResponse } from '../interfaces/jira.interfaces';

interface AxiosError {
  isAxiosError: boolean;
  response?: {
    status: number;
    statusText: string;
    data: IJiraErrorResponse;
  };
  message: string;
}

export const handleError = (error: AxiosError | Error): void => {
  let axiosResponse;

  if ('isAxiosError' in error && error.isAxiosError) {
    const status = error.response?.status;
    const errorCode = error.response?.statusText;
    let message = '';

    const errorData = error.response?.data as IJiraErrorResponse;

    if (errorData) {
      if (errorData.errorMessages && Array.isArray(errorData.errorMessages)) {
        message = errorData.errorMessages.join(', ');
      } else {
        message = errorData.message || JSON.stringify(errorData);
      }
    } else {
      message = error.message;
    }

    axiosResponse = {
      status,
      errorCode,
      message,
      data: {},
    };

    switch (axiosResponse.status) {
      case 400:
        throw new BadRequestException(axiosResponse);
      case 401:
        throw new UnauthorizedException(axiosResponse);
      case 403:
        throw new ForbiddenException(axiosResponse);
      case 404:
        throw new NotFoundException(axiosResponse);
      case 409:
        throw new ConflictException(axiosResponse);
      default:
        throw new InternalServerErrorException(axiosResponse);
    }
  } else {
    switch (error.constructor) {
      case NotFoundException:
        throw new NotFoundException({
          status: 404,
          errorCode: 'not_found',
          message: error.message,
          data: {},
        });
      case ConflictException:
        throw new ConflictException({
          status: 409,
          errorCode: 'conflict',
          message: error.message,
          data: {},
        });
      case BadRequestException:
        throw new BadRequestException({
          status: 400,
          errorCode: 'bad_request',
          message: error.message,
          data: {},
        });
      case UnauthorizedException:
        throw new UnauthorizedException({
          status: 401,
          errorCode: 'unauthorized',
          message: error.message,
          data: {},
        });
      case ForbiddenException:
        throw new ForbiddenException({
          status: 403,
          errorCode: 'forbidden',
          message: error.message,
          data: {},
        });
      case InternalServerErrorException:
        throw new InternalServerErrorException({
          status: 500,
          errorCode: 'internal_server_error',
          message: error.message,
          data: {},
        });
      default:
        throw new InternalServerErrorException({
          status: 500,
          errorCode: 'internal_server_error',
          message: 'An unexpected error occurred',
          data: {},
        });
    }
  }
};
