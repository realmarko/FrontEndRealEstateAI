// Recognizes a pasted/typed pair of coordinates in the map's search box (map-view.component.ts's
// searchAddress) so it can pan straight there instead of sending it to the Geocoder, which
// doesn't reliably parse the DMS form (°/′/″) and would otherwise burn a billed API call on
// something that was never an address to begin with. Returns null for anything else, so normal
// address/listing-title text falls through to the existing geocoding search unchanged.
// Minutes/seconds marks accept both the straight ASCII quotes most people actually type and the
// curly/prime variants (’ ′ for minutes, ″ for seconds) that copy-pasting from Google Maps, Word,
// or a phone's smart-quotes keyboard commonly substitutes in.
const DMS_PATTERN =
  /(\d{1,3})\s*°\s*(\d{1,2})\s*['’′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([NSns])[,\s]+(\d{1,3})\s*°\s*(\d{1,2})\s*['’′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([EWew])/;

// Plain "lat,lng" or "lat lng" decimal degrees — the other common format for a pasted coordinate
// pair (e.g. copied from Google Maps' own "Plus code"/coordinates display).
const DECIMAL_PATTERN = /^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;

function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return direction === 'S' || direction === 'W' ? -decimal : decimal;
}

export function parseCoordinates(query: string): google.maps.LatLngLiteral | null {
  const trimmed = query.trim();

  const dmsMatch = trimmed.match(DMS_PATTERN);
  if (dmsMatch) {
    const [, latDeg, latMin, latSec, latDir, lngDeg, lngMin, lngSec, lngDir] = dmsMatch;
    const lat = dmsToDecimal(Number(latDeg), Number(latMin), Number(latSec), latDir.toUpperCase());
    const lng = dmsToDecimal(Number(lngDeg), Number(lngMin), Number(lngSec), lngDir.toUpperCase());
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }

  const decimalMatch = trimmed.match(DECIMAL_PATTERN);
  if (decimalMatch) {
    const lat = Number(decimalMatch[1]);
    const lng = Number(decimalMatch[2]);
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }

  return null;
}
