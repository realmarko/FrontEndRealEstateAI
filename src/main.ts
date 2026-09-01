import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadGoogleMaps } from './app/core/utils/load-google-maps';

loadGoogleMaps().catch((err) => console.error(err));

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
