import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Shared by every service that touches localStorage/sessionStorage/window/navigator directly —
// none of those exist during SSR/prerendering (build-time rendering has no real browser). Call
// this once per service, from a field initializer or constructor (a valid Angular injection
// context), and guard the browser-only access with the result instead of each service
// reimplementing the same inject(PLATFORM_ID) + isPlatformBrowser pair.
export function isBrowser(): boolean {
  return isPlatformBrowser(inject(PLATFORM_ID));
}
