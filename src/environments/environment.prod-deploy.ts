import { GOOGLE_MAPS_API_KEY } from './env-keys';

// Used only for the deployed production site (espacial.com.mx) — same reasoning as
// environment.dev-deploy.ts: the frontend and backend live on separate subdomains behind
// separate CloudFront distributions, so the API URL has to be absolute.
export const environment = {
  production: true,
  apiUrl: 'https://api.espacial.com.mx/api',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  sentryDsn: ''
};
