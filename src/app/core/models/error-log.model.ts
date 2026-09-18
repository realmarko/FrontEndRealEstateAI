export interface ErrorLog {
  id: string;
  occurredAt: string;
  source: 'Backend' | 'Frontend';
  severity: 'Warning' | 'Error' | 'Critical';
  section: string;
  message: string;
  // Not the trace itself — fetched on demand via ErrorLogService.getDetail only when a row is
  // expanded, so listing/paginating/filtering doesn't pull megabytes of mostly-unread trace text.
  hasStackTrace: boolean;
  userId: string | null;
  userEmail: string | null;
  userAgent: string | null;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface ErrorLogDetail {
  id: string;
  stackTrace: string | null;
}

export interface PagedErrorLogs {
  items: ErrorLog[];
  page: number;
  pageSize: number;
  totalCount: number;
}
