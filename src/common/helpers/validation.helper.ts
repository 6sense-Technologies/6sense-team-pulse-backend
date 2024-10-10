import { BadRequestException } from '@nestjs/common';

export const validateAccountId = (accountId: string): void => {
  if (!accountId || accountId.trim() === '') {
    throw new BadRequestException('Account ID cannot be empty.');
  }
};

export const validateDate = (date: string): void => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new BadRequestException(
      'Invalid date format. Please use YYYY-MM-DD.',
    );
  }
};

export const validatePagination = (page: number, limit: number): void => {
  if (page < 1) {
    throw new BadRequestException(
      'Invalid page number. It must be a positive integer greater than 0.',
    );
  }

  if (limit < 1) {
    throw new BadRequestException(
      'Invalid limit number. It must be a positive integer greater than 0.',
    );
  }
};
