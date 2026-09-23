import { environment } from '../../../environments/environment';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // 'geometry' adds google.maps.geometry.poly.containsLocation, used to filter listings by
    // municipality polygon client-side (see map-view.component.ts) — same in-memory filtering
    // approach already used for every other listing filter, so no new backend search endpoint.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the Google Maps script.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
