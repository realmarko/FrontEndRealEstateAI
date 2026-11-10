import { Route } from '@angular/router';
import { PUBLIC_SLUGS, LogicalKey } from './route-slugs';

// Expands one logical public route into its EN + ES Route pair, both pointing at the same
// component/guards, each tagged with data.lang so TranslationService (SSR) and the navbar's
// language toggle (client) know which language a given matched route represents.
//
// `suffix` is appended after the resource's own slug and is NOT translated (ids, '/new', '/edit',
// ...) — only the resource segment itself differs by language. Passing a guarded `base` (e.g.
// canActivate: [authGuard]) still produces both language paths, so a signed-in user editing a
// resource while browsing in Spanish doesn't get silently bounced to an English URL — but these
// sub-routes are deliberately left OUT of PUBLIC_SLUGS-driven SEO/hreflang/sitemap treatment,
// since they're never reachable by an anonymous visitor anyway.
export function pairRoutes(key: LogicalKey, suffix: string, base: Omit<Route, 'path'>): Route[] {
  const slugs = PUBLIC_SLUGS[key];
  return (Object.keys(slugs) as (keyof typeof slugs)[]).map((lang) => ({
    ...base,
    path: suffix ? `${slugs[lang]}/${suffix}` : slugs[lang],
    data: { ...(base.data ?? {}), lang }
  }));
}
