import { environment } from '../../../environments/environment';

let sentryModule: typeof import('@sentry/angular') | null = null;
let initPromise: Promise<void> | null = null;

// @sentry/angular's SDK (tracing + replay integrations included) was the single largest piece
// of the initial bundle (~370kB raw, over half the total) — loading it eagerly made no sense
// while every environment's DSN is empty (no Sentry project exists yet, see environment.ts
// comment). Dynamically imported and initialized only once a real DSN is configured; a true
// no-op everywhere else, with zero bundle cost until that day.
export function initSentry(): Promise<void> {
  if (!environment.sentryDsn) return Promise.resolve();
  if (!initPromise) {
    initPromise = import('@sentry/angular').then((Sentry) => {
      sentryModule = Sentry;
      Sentry.init({
        dsn: environment.sentryDsn,
        environment: environment.production ? 'production' : 'development',
        tracesSampleRate: 0.1
      });
    });
  }
  return initPromise;
}

// No-ops if Sentry was never loaded (empty DSN) or hasn't finished its dynamic import yet —
// losing a stray error report during that brief startup window is an acceptable tradeoff for
// not blocking app bootstrap on Sentry's own load.
export function captureException(error: unknown): void {
  sentryModule?.captureException(error);
}
