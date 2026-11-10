import type { Lang } from '../services/translation.service';

// Single source of truth for every public (unauthenticated-reachable, SEO/share-relevant) route's
// EN/ES path segment — read by app.routes.ts (route generation), app.routes.server.ts (prerender
// mirroring), SeoService (hreflang) and localizedPath() below. Routes gated by authGuard/roleGuard
// (every /new, /edit, admin/*, favorites, messages, saved-searches, pipeline) are NOT here: they're
// never indexed or shared externally, so they don't need a translated slug, only (where they nest
// under one of these resources) to inherit whichever prefix the user is already on — see
// localized-route.ts's pairRoutes() for how that's done without listing them here too.
export const PUBLIC_SLUGS = {
  home: { en: '', es: '' },
  forAgents: { en: 'for-agents', es: 'para-agentes' },
  login: { en: 'login', es: 'iniciar-sesion' },
  register: { en: 'register', es: 'registro' },
  forgotPassword: { en: 'forgot-password', es: 'recuperar-contrasena' },
  resetPassword: { en: 'reset-password', es: 'restablecer-contrasena' },
  verifyEmail: { en: 'verify-email', es: 'verificar-correo' },
  privacy: { en: 'privacy', es: 'privacidad' },
  terms: { en: 'terms', es: 'terminos' },
  listings: { en: 'listings', es: 'propiedades' },
  map: { en: 'map', es: 'mapa' },
  agents: { en: 'agents', es: 'agentes' },
  owners: { en: 'owners', es: 'propietarios' },
  // ES was already live pre-existing; EN is the new alias.
  agencies: { en: 'agencies', es: 'inmobiliarias' },
  developments: { en: 'developments', es: 'fraccionamientos' },
  compare: { en: 'compare', es: 'comparar' }
} as const satisfies Record<string, Record<Lang, string>>;

export type LogicalKey = keyof typeof PUBLIC_SLUGS;

export function slugFor(key: LogicalKey, lang: Lang): string {
  return PUBLIC_SLUGS[key][lang];
}

// Builds an app-relative path ("/propiedades/abc123") for a public route in the given language,
// optionally with extra static/dynamic segments appended after the resource's own slug (e.g.
// localizedPath('listings', 'es', listing.id) -> '/propiedades/abc123').
export function localizedPath(key: LogicalKey, lang: Lang, ...segments: (string | number)[]): string {
  const parts = [slugFor(key, lang), ...segments.map(String)].filter((s) => s !== '');
  return '/' + parts.join('/');
}

// Reverse lookup used by the navbar's language toggle: given the first URL segment of the page
// you're currently on, finds which public resource it belongs to (in EITHER language), so the
// toggle can rebuild the same page's URL in the other language instead of just swapping the
// dictionary in place.
export function logicalKeyForSlug(segment: string): LogicalKey | undefined {
  return (Object.keys(PUBLIC_SLUGS) as LogicalKey[]).find(
    (key) => PUBLIC_SLUGS[key].en === segment || PUBLIC_SLUGS[key].es === segment
  );
}
