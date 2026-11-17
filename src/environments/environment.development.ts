import { FACEBOOK_APP_ID, GOOGLE_CLIENT_ID, GOOGLE_MAPS_API_KEY } from './env-keys';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:5081/api',
  siteUrl: 'http://localhost:4200',
  // Gates the admin-only "Enviar a producción" button on the listing detail page — true here and
  // on dev-deploy, false on prod-deploy (see that file's own comment). Local dev against a local
  // backend counts as "dev" too, since ProdSync:TargetApiUrl would only ever be configured there
  // deliberately, never by accident.
  isDevEnvironment: true,
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  googleClientId: GOOGLE_CLIENT_ID,
  facebookAppId: FACEBOOK_APP_ID,
  // A Sentry DSN is meant to be public (it's embedded in client-side code by design, unlike the
  // Maps key above) — empty until a real Sentry project exists; the SDK no-ops safely either way.
  sentryDsn: ''
};
