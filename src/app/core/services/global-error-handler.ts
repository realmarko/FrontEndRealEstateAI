import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
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

// Thrown by the browser/Angular's router when a lazy `loadComponent()` chunk 404s — the visitor's
// tab still has an old index.html referencing chunk hashes that no longer exist after a new
// deploy replaced the built files. Retrying the same import always fails the same way; only a
// full reload (which fetches the current index.html and its current chunk manifest) recovers.
const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i;
// Guards against a reload loop if the deploy that caused this is somehow still broken/unreachable
// after reloading (e.g. the visitor is offline) — without it, the same stale-chunk error would
// just fire again on the freshly reloaded page and reload forever.
const CHUNK_RELOAD_GUARD_KEY = 'reapp_chunk_reload_attempted';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}

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

  constructor() {
    // A route that activates successfully means the current chunk manifest is good again — clear
    // the guard so a chunk failure from a *later* deploy (while this tab stays open) can still
    // trigger one reload of its own, instead of the very first reload silently disarming it for
    // the rest of the tab's lifetime.
    inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY));
  }

  handleError(error: unknown): void {
    Sentry.captureException(error);

    const message = describeError(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.errorReporting.report(message, stack);

    if (isChunkLoadError(error)) {
      this.reloadForStaleChunk();
      return;
    }

    console.error(error);
  }

  private reloadForStaleChunk(): void {
    if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
    window.location.reload();
  }
}
