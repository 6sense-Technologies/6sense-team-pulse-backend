import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { IiraErrorResponse } from '../interfaces/jira.interfaces';

@Injectable()
export class AxiosErrorHelper {
  private static instance: AxiosErrorHelper;

  static getInstance(): AxiosErrorHelper {
    if (!AxiosErrorHelper.instance) {
      AxiosErrorHelper.instance = new AxiosErrorHelper();
    }
    return AxiosErrorHelper.instance;
  }

  handleAxiosApiError(error: AxiosError) {
    const status = error.response?.status;
    const errorCode = error.response?.statusText;
    let message = '';

    const errorData = error.response?.data as IiraErrorResponse;

    if (errorData) {
      if (errorData.errorMessages && Array.isArray(errorData.errorMessages)) {
        message = errorData.errorMessages.join(', ');
      } else {
        message = errorData.message || JSON.stringify(errorData);
      }
    } else {
      message = error.message;
    }

    const data = {};

    return {
      status,
      errorCode,
      message,
      data,
    };
  }
}
