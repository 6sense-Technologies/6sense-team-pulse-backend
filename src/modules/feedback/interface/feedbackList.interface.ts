export interface IFeedbackQuery {
  page?: number;
  limit?: number;
  filter?: string;
  search?: string;
  sort?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}
