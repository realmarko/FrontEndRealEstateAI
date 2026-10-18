import { RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';

const PAGE_SIZE = 100;

// Walks a paginated anonymous list endpoint (PagedResult<T> shape: items/totalCount) to collect
// every id, so the build-time prerenderer can generate a static page per real listing/agent/
// owner/agency/fraccionamiento. Runs during `ng build` against the real deployed API (environment
// is swapped to the dev/prod absolute apiUrl by the same build's fileReplacements) for an actual
// deploy build.
//
// ci.yml's plain `ng build` (no fileReplacement, environment.ts's relative '/api') has no origin
// to fetch against at all — that's the ONLY case this degrades quietly to zero dynamic pages for,
// since that smoke-test build is never deployed. Any other failure (unreachable API, a bad
// response mid-pagination, an unexpected body shape) during a REAL dev-deploy/prod-deploy build
// is NOT swallowed — it throws and fails the whole build, same as any other build step. Silently
// shipping a production deploy with some or all of its dynamic pages missing their prerendered
// HTML (and so missing SEO/structured data for crawlers — the entire point of this mechanism)
// would be worse than a loud build failure that gets noticed and retried.
async function collectIds(listPath: string): Promise<{ id: string }[]> {
  if (!/^https?:\/\//.test(environment.apiUrl)) return [];

  const ids: { id: string }[] = [];
  let page = 1;
  let totalCount = Infinity;

  while ((page - 1) * PAGE_SIZE < totalCount) {
    const separator = listPath.includes('?') ? '&' : '?';
    const response = await fetch(`${environment.apiUrl}${listPath}${separator}page=${page}&pageSize=${PAGE_SIZE}`);
    if (!response.ok) {
      throw new Error(`collectIds(${listPath}): page ${page} returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as { items?: { id: string | number }[]; totalCount?: number };
    if (!Array.isArray(body.items) || typeof body.totalCount !== 'number') {
      throw new Error(`collectIds(${listPath}): unexpected response shape on page ${page}`);
    }

    totalCount = body.totalCount;
    for (const item of body.items) {
      ids.push({ id: String(item.id) });
    }
    page++;
  }

  return ids;
}

// Routes guarded by authGuard have no meaningful server-rendered state (no auth session exists
// during a build) — prerendering them would just bake in a logged-out redirect. Render them
// client-side only, same as the two already-dynamic auth-gated edit routes below.
const clientOnlyPaths = [
  'listings/new',
  'agents/new',
  'agents/edit',
  'owners/new',
  'owners/edit',
  'inmobiliarias/edit',
  'inmobiliarias/new',
  'favorites',
  'messages',
  'saved-searches',
  'pipeline',
  'admin/errors',
  'admin/fraccionamientos',
  'admin/inmobiliarias'
];

export const serverRoutes: ServerRoute[] = [
  ...clientOnlyPaths.map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  { path: 'listings/:id/edit', renderMode: RenderMode.Client },
  // Client-only, not prerendered: unlike the listing page itself, this calls the rate-limited
  // viability-preview endpoint (9 DENUE lookups) on load — prerendering it for every Land/
  // commercial listing at build time would burn that external quota on every deploy for a page
  // that doesn't need search-engine/link-preview treatment the way the listing page does.
  { path: 'listings/:id/viabilidad-comercial', renderMode: RenderMode.Client },
  { path: 'admin/inmobiliarias/:id/edit', renderMode: RenderMode.Client },
  {
    path: 'listings/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => collectIds('/listings')
  },
  {
    path: 'agents/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => collectIds('/agents')
  },
  {
    path: 'owners/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => collectIds('/owners')
  },
  {
    path: 'inmobiliarias/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => collectIds('/brokerages/directory')
  },
  {
    path: 'fraccionamientos/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => collectIds('/fraccionamientos/published')
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
