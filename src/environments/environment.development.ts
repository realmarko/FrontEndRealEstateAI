import { GOOGLE_MAPS_API_KEY } from './env-keys';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:5081/api',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  // A Sentry DSN is meant to be public (it's embedded in client-side code by design, unlike the
  // Maps key above) — empty until a real Sentry project exists; the SDK no-ops safely either way.
  sentryDsn: ''
};
