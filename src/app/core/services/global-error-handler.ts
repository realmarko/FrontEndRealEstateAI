import { ErrorHandler, Injectable, inject } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { ErrorReportingService } from './error-reporting.service';

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

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.errorReporting.report(message, stack);

    console.error(error);
  }
}
