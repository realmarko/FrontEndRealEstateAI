let loadPromise: Promise<void> | null = null;
let loaded = false;

// Mirrors load-google-identity.ts's pattern exactly — dynamically injects Facebook's SDK once
// and caches the in-flight promise so Login and Register (both of which call this) never load
// it twice. FB.init() is safe to call multiple times with the same config (unlike Google's
// accounts.id.initialize(), which logs a warning), so there's no equivalent "set the handler,
// init once" split here. Tracks `loaded` itself rather than checking `typeof FB` — FB is
// declared as always-defined ambient global (facebook-sdk.d.ts), so TS can't narrow on that.
export function loadFacebookSdk(appId: string): Promise<void> {
  if (loaded) {
    FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
      loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load the Facebook SDK script.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Triggers the Facebook Login popup and resolves with the access token the backend verifies
// server-side (AuthController.Facebook) — rejects on cancel/deny so callers can stay silent
// about it, same as the Google button's catch blocks do for a blocked GIS script.
export function loginWithFacebookSdk(): Promise<string> {
  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        if (response.status === 'connected' && response.authResponse) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error('Facebook login was cancelled or not authorized.'));
        }
      },
      { scope: 'email' }
    );
  });
}
