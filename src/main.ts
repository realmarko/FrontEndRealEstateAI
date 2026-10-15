import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadGoogleMaps } from './app/core/utils/load-google-maps';
import { initSentry } from './app/core/services/sentry';

// Fire-and-forget: a true no-op (no network fetch at all) while every environment's DSN stays
// empty — see sentry.ts for why this isn't a static `@sentry/angular` import anymore.
initSentry();

loadGoogleMaps().catch((err) => console.error(err));

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
