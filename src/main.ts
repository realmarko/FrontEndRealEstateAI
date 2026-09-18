import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadGoogleMaps } from './app/core/utils/load-google-maps';
import { environment } from './environments/environment';

// Must run before bootstrap so Sentry can instrument the app as it starts up. No-ops safely with
// an empty DSN (see environment.ts) until a real Sentry project is created.
Sentry.init({
  dsn: environment.sentryDsn,
  environment: environment.production ? 'production' : 'development',
  tracesSampleRate: 0.1
});

loadGoogleMaps().catch((err) => console.error(err));

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
