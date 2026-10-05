import { GOOGLE_CLIENT_ID, GOOGLE_MAPS_API_KEY } from './env-keys';

export const environment = {
  production: true,
  apiUrl: '/api',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  googleClientId: GOOGLE_CLIENT_ID,
  sentryDsn: ''
};
