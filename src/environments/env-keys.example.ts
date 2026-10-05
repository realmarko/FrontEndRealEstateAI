// Copy this file to env-keys.ts (gitignored) and fill in your own key.
// Get one at https://console.cloud.google.com/google/maps-apis/credentials
// Restrict it: HTTP referrers = your domain(s) + localhost, APIs = Maps JavaScript API, Places API.
export const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

// OAuth 2.0 Client ID (type "Web application") from
// https://console.cloud.google.com/apis/credentials — used for "Sign in with Google". Not a
// secret (it's meant to be public, embedded in the frontend bundle), but kept alongside the
// Maps key for consistency with this file's pattern. Authorized JavaScript origins must include
// your domain(s) + http://localhost:4200; no redirect URI is needed (token-based GIS flow).
export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
