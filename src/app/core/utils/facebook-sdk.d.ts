// Minimal ambient types for the Facebook JavaScript SDK — no official @types package covers it,
// so this declares just the surface load-facebook-sdk.ts and the login/register components
// actually call.
interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: {
    accessToken: string;
  };
}

interface FacebookStatic {
  init(config: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope: string }
  ): void;
}

declare const FB: FacebookStatic;
