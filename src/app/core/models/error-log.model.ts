export interface ErrorLogDetail {
  id: string;
  stackTrace: string | null;
}

// One row per distinct (source, severity, section, message) combination, not per raw occurrence
// — the backend collapses repeats into a single row with `count`, so the admin list shows
// "this broke 40 times" instead of the same card 40 times in a row. `sampleId` is the most
// recent occurrence's id, reused for the existing stack-trace-detail lookup.
export interface ErrorLogGroup {
  source: 'Backend' | 'Frontend';
  severity: 'Warning' | 'Error' | 'Critical';
  section: string;
  message: string;
  count: number;
  // How many of `count` are still unresolved — equal to count/0 under the unresolved/resolved
  // filters (the filter already guarantees it), but can be less than count under "all" for a
  // partially-resolved group. The "resolve all" action only ever touches this many rows.
  unresolvedCount: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  sampleId: string;
  hasStackTrace: boolean;
  // Who most recently hit this error, and from what — see ErrorLogGroupDto's own remarks on the
  // backend: exact for a count of 1, just the latest of possibly several users otherwise.
  sampleUserEmail: string | null;
  sampleUserAgent: string | null;
  resolved: boolean;
}

export interface PagedErrorLogGroups {
  items: ErrorLogGroup[];
  page: number;
  pageSize: number;
  totalCount: number;
}
