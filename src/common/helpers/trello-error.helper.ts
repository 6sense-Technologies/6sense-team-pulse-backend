import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AxiosError } from 'axios';

@Injectable()
export class TrelloErrorHelper {
  private static instance: TrelloErrorHelper;

  static getInstance(): TrelloErrorHelper {
    TrelloErrorHelper.instance =
      TrelloErrorHelper.instance || new TrelloErrorHelper();
    return TrelloErrorHelper.instance;
  }

  handleTrelloApiError(error: unknown): void {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || 'An error occurred';

      switch (status) {
        case 400:
          throw new BadRequestException(message || 'Bad Request');
        case 401:
          throw new UnauthorizedException(message || 'Unauthorized');
        case 404:
          throw new NotFoundException(message || 'Not Found');
        case 409:
          throw new ConflictException(message || 'Conflict');
        case 500:
          throw new InternalServerErrorException(
            message || 'Internal Server Error',
          );
        default:
          throw new InternalServerErrorException('Unexpected error occurred');
      }
    } else {
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
