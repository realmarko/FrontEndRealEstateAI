// Shared circular-badge marker icon (category color + a white glyph) used by both /map's own POI
// checklist layer (map-view.component.ts) and the viability-report page's generator/competitor
// markers — one visual language for "this dot is a school/mall/hospital/..." across the app,
// instead of each page inventing its own pin style.
export function createPoiIcon(color: string, glyph: string): google.maps.Icon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">` +
    `<circle cx="17" cy="17" r="16" fill="${color}" stroke="#fff" stroke-width="2"/>` +
    glyph +
    `</svg>`;
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: { width: 34, height: 34 } as google.maps.Size,
    anchor: { x: 17, y: 17 } as google.maps.Point
  };
}

export const SCHOOL_GLYPH =
  '<polygon points="17,10 26,14 17,18 8,14" fill="#fff"/>' +
  '<path d="M12,15.5 L12,20.5 Q17,23.5 22,20.5 L22,15.5" fill="none" stroke="#fff" stroke-width="1.6"/>' +
  '<line x1="26" y1="14" x2="26" y2="20" stroke="#fff" stroke-width="1.4"/>';

export const PHARMACY_GLYPH = '<rect x="14" y="8" width="6" height="18" rx="1.5" fill="#fff"/><rect x="8" y="14" width="18" height="6" rx="1.5" fill="#fff"/>';

export const MALL_GLYPH =
  '<path d="M13,14 C13,9.5 21,9.5 21,14" fill="none" stroke="#fff" stroke-width="1.8"/>' +
  '<path d="M11,14 L23,14 L22,26 L12,26 Z" fill="#fff"/>';

export const PARK_GLYPH = '<circle cx="17" cy="13" r="6.2" fill="#fff"/><rect x="15.3" y="18.5" width="3.4" height="7.5" fill="#fff"/>';

export const GYM_GLYPH =
  '<rect x="9" y="15.3" width="16" height="3.4" fill="#fff"/>' +
  '<rect x="6.5" y="11.5" width="4.5" height="11" rx="1.3" fill="#fff"/>' +
  '<rect x="23" y="11.5" width="4.5" height="11" rx="1.3" fill="#fff"/>';

export const CONVENIENCE_STORE_GLYPH =
  '<path d="M8,16 L17,9 L26,16 Z" fill="#fff"/>' +
  '<rect x="9" y="16" width="16" height="9" fill="#fff"/>' +
  '<rect x="14.5" y="19" width="5" height="6" fill="rgba(0,0,0,0.25)"/>';

// New for the viability report's traffic-generator map — a simple cross/plus reads as "hospital"
// at a 34px badge size without needing a more literal (and less legible at that size) icon.
export const HOSPITAL_GLYPH = '<rect x="14.5" y="9" width="5" height="18" rx="1" fill="#fff"/><rect x="8" y="15.5" width="18" height="5" rx="1" fill="#fff"/>';

// A simple bus silhouette — front window + body — distinct enough from the other glyphs at 34px.
export const BUS_GLYPH =
  '<rect x="8.5" y="11" width="17" height="13" rx="2.5" fill="#fff"/>' +
  '<rect x="11" y="13.2" width="12" height="4.6" rx="0.8" fill="' + '#000' + '" fill-opacity="0.18"/>' +
  '<circle cx="12.5" cy="24.5" r="1.8" fill="#fff"/><circle cx="21.5" cy="24.5" r="1.8" fill="#fff"/>';

// A fuel pump silhouette — body + nozzle hose — reads as "gas station" at 34px.
export const GAS_STATION_GLYPH =
  '<rect x="9" y="11" width="10" height="15" rx="1.2" fill="#fff"/>' +
  '<rect x="11.5" y="13.5" width="5" height="5" fill="rgba(0,0,0,0.25)"/>' +
  '<path d="M19,15 L22,15 L22,22.5 Q22,24 23.5,24 Q25,24 25,22.5 L25,13" fill="none" stroke="#fff" stroke-width="1.6"/>';

// Three stacked toy blocks of different heights — a generic "kids/childcare" pictogram rather
// than anything tied to a specific daycare brand.
export const CHILDCARE_GLYPH =
  '<rect x="8" y="18" width="6" height="6" rx="1" fill="#fff"/>' +
  '<rect x="15.5" y="12.5" width="6" height="11.5" rx="1" fill="#fff"/>' +
  '<rect x="23" y="16" width="5.5" height="8" rx="1" fill="#fff"/>';

// A trophy silhouette — generic "sports/athletics" pictogram, distinct from GYM_GLYPH's dumbbell
// so a "centro deportivo" (sports complex) reads as its own category rather than a second gym.
export const SPORTS_CENTER_GLYPH =
  '<path d="M12,9 L22,9 L22,14 Q22,19 17,19 Q12,19 12,14 Z" fill="#fff"/>' +
  '<path d="M12,10 Q8,10 8,13.5 Q8,17 12.5,17" fill="none" stroke="#fff" stroke-width="1.4"/>' +
  '<path d="M22,10 Q26,10 26,13.5 Q26,17 21.5,17" fill="none" stroke="#fff" stroke-width="1.4"/>' +
  '<rect x="15.5" y="19" width="3" height="4" fill="#fff"/>' +
  '<rect x="12.5" y="23.5" width="9" height="2" rx="1" fill="#fff"/>';

// A shopping-cart silhouette — shared by every grocery-chain category (Walmart, Chedraui, Bodega
// Aurrera, Tiendas 3B); they're distinguished from each other by badge color alone rather than by
// reproducing each chain's own trademarked logo, same as how OXXO already gets a generic
// convenience-store glyph instead of its real storefront branding.
export const SHOPPING_CART_GLYPH =
  '<path d="M8,9 L11,9 L14,20 L24,20 L26.5,12.5 L12.5,12.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<circle cx="15.5" cy="24.5" r="1.8" fill="#fff"/><circle cx="22" cy="24.5" r="1.8" fill="#fff"/>';

// A classic bank-building silhouette (pediment + columns) — reads as "bank/ATM" without tying the
// icon to any one institution's branding.
export const BANK_GLYPH =
  '<polygon points="17,8 27,13 7,13" fill="#fff"/>' +
  '<rect x="8.5" y="14" width="2.6" height="10" fill="#fff"/>' +
  '<rect x="13.7" y="14" width="2.6" height="10" fill="#fff"/>' +
  '<rect x="18.9" y="14" width="2.6" height="10" fill="#fff"/>' +
  '<rect x="24.1" y="14" width="2.6" height="10" fill="#fff"/>' +
  '<rect x="7" y="25" width="20" height="2" rx="0.5" fill="#fff"/>';
