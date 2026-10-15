import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { GlobalErrorHandler } from './core/services/global-error-handler';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Async variant: defers the real animations engine to a lazy chunk fetched on first actual
    // animation trigger, instead of shipping it in the initial bundle — same animation behavior
    // (ngx-toastr's toasts included), just not paid for by every visitor on first paint.
    provideAnimationsAsync(),
    provideToastr({ positionClass: 'toast-top-right', timeOut: 4000, preventDuplicates: true }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }, provideClientHydration(withEventReplay())
  ]
};
