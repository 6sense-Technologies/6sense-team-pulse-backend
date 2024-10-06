import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';

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
    const message = error.response?.data;

    return {
      status,
      errorCode,
      message,
    };
  }
}
