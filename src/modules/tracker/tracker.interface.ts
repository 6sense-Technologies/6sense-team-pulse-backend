export interface ActivityLog {
  organization_id: string;
  user_id: string;
  app_name: string;
  browser_url?: string;
  window_title: string;
  timestamp: string;
  pid: number;
  event: string;
  favicon_url?: string;
  duration_sec?: number;
}

export interface ActivitySession {
  organization: string;
  user: string;
  appName: string;
  browserUrl?: string;
  faviconUrl?: string;
  pid: number;
  windowTitle: string;
  startTime: string;
  endTime: string;
}
