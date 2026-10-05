let loadPromise: Promise<void> | null = null;

// Mirrors load-google-maps.ts's pattern exactly — dynamically injects Google's script once and
// caches the in-flight promise so Login and Register (both of which call this) never load it
// twice.
export function loadGoogleIdentity(): Promise<void> {
  if (typeof google !== 'undefined' && google.accounts?.id) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the Google Identity Services script.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

let currentCredentialHandler: ((idToken: string) => void) | null = null;
let initialized = false;

// Google logs "initialize() is called multiple times... only the last initialized instance will
// be used" if called again — harmless (last call does win), but noisy every time a visitor
// navigates between /login and /register within the same SPA session, since each page's
// ngAfterViewInit used to call google.accounts.id.initialize() itself. Call this once per page
// load instead: the first caller actually initializes GIS, and every later call (same page
// re-entered, or the other auth page) just swaps which handler the shared callback delegates to.
export function setGoogleCredentialHandler(clientId: string, handler: (idToken: string) => void): void {
  currentCredentialHandler = handler;
  if (initialized) return;

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => currentCredentialHandler?.(response.credential)
  });
  initialized = true;
}
