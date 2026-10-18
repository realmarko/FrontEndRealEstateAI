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
