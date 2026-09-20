import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { ErrorReportingService } from './error-reporting.service';

// Many of this app's services subscribe to an HTTP call with no error callback (e.g.
// InquiryService.refresh) — a failed request then throws uncaught and lands here as the raw
// HttpErrorResponse, which isn't an Error instance, so String(error) fell through to
// "[object Object]" instead of anything useful. Handled explicitly here (once, for every such
// call site) rather than adding an error callback to each subscribe individually.
// Matches ErrorsController's own MaxMessageLength — without this cap, a large/deeply-nested
// thrown object could JSON.stringify past the backend's limit, get 400'd, and be swallowed
// silently by ErrorReportingService's empty error callback (report to Sentry above still works;
// only the in-app ErrorLog side would quietly lose it).
const MAX_MESSAGE_LENGTH = 2000;

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return `HTTP ${error.status}${error.statusText ? ' ' + error.statusText : ''} for ${error.url ?? 'unknown URL'}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  let serialized: string;
  try {
    // JSON.stringify returns the actual JS value `undefined` (not the string "undefined") for
    // undefined/Symbol/function inputs — falling through untouched would drop the `message` key
    // entirely from the POST body below (JSON.stringify omits undefined properties), silently
    // failing ErrorsController's required-field check instead of reporting anything at all.
    serialized = JSON.stringify(error) ?? String(error);
  } catch {
    serialized = String(error);
  }
  return serialized.length > MAX_MESSAGE_LENGTH ? serialized.slice(0, MAX_MESSAGE_LENGTH) : serialized;
}

// Registered in app.config.ts as the ErrorHandler — catches anything uncaught anywhere in the
// app (a component throwing, a broken template binding), including window.onerror and unhandled
// promise rejections via provideBrowserGlobalErrorListeners() in app.config.ts, which routes
// those through this same handler. Sentry gets the full exception with breadcrumbs; ErrorLog (via
// ErrorReportingService) gets a lighter record for the in-app admin view.
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorReporting = inject(ErrorReportingService);

  handleError(error: unknown): void {
    Sentry.captureException(error);

    const message = describeError(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.errorReporting.report(message, stack);

    console.error(error);
  }
}
