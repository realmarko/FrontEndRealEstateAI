import { GOOGLE_MAPS_API_KEY } from './env-keys';

// Used only for the deployed dev site (dev.espacial.com.mx) — distinct from environment.ts
// (production build config, apiUrl '/api', assumes a same-origin reverse proxy) because the
// deployed dev frontend and dev backend live on different subdomains behind separate CloudFront
// distributions, so the API URL has to be absolute.
export const environment = {
  production: true,
  apiUrl: 'https://api-dev.espacial.com.mx/api',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  sentryDsn: ''
};
