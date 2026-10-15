import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface PageSeo {
  title: string;
  description: string;
  // Relative to the site root (e.g. '/listings/abc123'), not an absolute URL — buildCanonical
  // below is the one place that knows the real origin, so every caller can stay environment-
  // agnostic (dev/dev-deploy/prod-deploy all resolve to a different real domain).
  path: string;
  image?: string;
  // 'website' for list/static pages, 'article' for a single entity's own detail page — the two
  // values Open Graph itself defines as meaningful for this kind of site.
  type?: 'website' | 'article';
  // A schema.org JSON-LD object (RealEstateListing, RealEstateAgent, Place, ...) — omitted for
  // every page except the dynamic entity-detail ones, which build and pass their own. Cleared
  // automatically on any set() call that doesn't pass one, so navigating away from a detail page
  // never leaves a stale listing's structured data describing the next page the visitor lands on.
  structuredData?: Record<string, unknown>;
}

const SITE_NAME = 'Espacial.com.mx';
const DEFAULT_DESCRIPTION =
  'Encuentra casas, departamentos y terrenos en venta y renta en México. Propiedades verificadas, agentes e inmobiliarias.';
const DEFAULT_IMAGE = '/favicon.svg';
// A search snippet/social preview truncates well past this anyway — capping here means every
// caller can pass a raw free-text field (a listing/agent/agency's own description or bio)
// straight through instead of each remembering to slice it themselves.
const MAX_DESCRIPTION_LENGTH = 160;

// Centralizes every page's <title>/meta tag management (Angular's own Title/Meta services, a
// manual <link rel="canonical">, and Open Graph/Twitter Card tags) so each route component
// makes one call instead of repeating this boilerplate — see feedback_seo_every_new_page memory:
// every new route is expected to call this, not just the pages covered in the initial pass.
//
// Caveat worth knowing, not fixable from here: this app is pure client-side rendering (no SSR/
// prerendering), so these tags only exist in the DOM after Angular runs. Google's own crawler
// executes JS and picks them up, but WhatsApp/Facebook/Twitter's link-preview bots fetch raw
// HTML only and never see them — og:image previews on a shared chat link won't work until SSR
// or prerendering is added separately.
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  // environment.apiUrl is the backend's origin, not the frontend's — the frontend has no
  // equivalent constant today, so this derives it from wherever the app is actually running,
  // which is correct in every environment (localhost, dev, prod) without adding a new one.
  private get origin(): string {
    return this.document.location.origin;
  }

  set(page: Partial<PageSeo> & Pick<PageSeo, 'title' | 'description' | 'path'>): void {
    const fullTitle = `${page.title} | ${SITE_NAME}`;
    // Collapse whitespace before truncating, not after — a free-text field's \r\n/leading
    // whitespace would otherwise eat into the length budget with junk instead of real content.
    const normalized = (page.description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim();
    const description = normalized.slice(0, MAX_DESCRIPTION_LENGTH);
    const url = `${this.origin}${page.path}`;
    const image = page.image ? this.absoluteUrl(page.image) : `${this.origin}${DEFAULT_IMAGE}`;
    const type = page.type ?? 'website';

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    this.setCanonical(url);
    this.setStructuredData(page.structuredData ?? null);
  }

  private absoluteUrl(src: string): string {
    return src.startsWith('http') ? src : `${this.origin}${src}`;
  }

  // Angular's Meta service only manages <meta> tags, not arbitrary <link> tags — canonical has
  // to be done by hand, same approach any Angular app without a router-canonical plugin takes.
  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  // One <script type="application/ld+json"> per page, same find-or-create-then-update approach
  // as setCanonical. Google reads this even though it only exists in the DOM after Angular runs
  // (its crawler executes JS, unlike WhatsApp/Facebook's) — see the class comment above.
  private setStructuredData(data: Record<string, unknown> | null): void {
    const existing = this.document.querySelector<HTMLScriptElement>('script[data-seo-jsonld]');
    if (!data) {
      existing?.remove();
      return;
    }

    const script = existing ?? this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo-jsonld', '');
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...data });
    if (!existing) this.document.head.appendChild(script);
  }
}
