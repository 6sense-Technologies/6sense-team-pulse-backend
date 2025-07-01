export interface IFeedbackQuery {
  page?: number;
  limit?: number;
  filter?: string;
  search?: string;
  sortOrder?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}
