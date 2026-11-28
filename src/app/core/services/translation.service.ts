import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { LogicalKey, localizedPath } from '../routing/route-slugs';

export type Lang = 'en' | 'es';

const DICTIONARIES: Record<Lang, Record<string, string>> = { en, es };

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly document = inject(DOCUMENT);

  // The site is Spanish-only for now (the English toggle was removed) — fixed at 'es' regardless
  // of which language a dual-registered route's data.lang carries (core/routing/localized-route.ts),
  // so an English URL (e.g. /agents, kept for existing links/SEO) still renders Spanish content.
  readonly lang = signal<Lang>('es');

  constructor() {
    this.document.documentElement.lang = this.lang();
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    this.document.documentElement.lang = lang;
  }

  // The one sanctioned way to build an internal link to a dual-registered public route (see
  // core/routing/localized-route.ts) — always resolves to the CURRENT language's slug, so a link
  // built on a Spanish page stays on Spanish URLs. Extra `segments` (an id, 'new', ...) are
  // appended untranslated after the resource's own slug.
  path(key: LogicalKey, ...segments: (string | number)[]): string {
    return localizedPath(key, this.lang(), ...segments);
  }

  // For SeoService's hreflang tags: both languages' paths for the same logical page, regardless
  // of which one is currently active.
  hreflangPaths(key: LogicalKey, ...segments: (string | number)[]): { en: string; es: string } {
    return { en: localizedPath(key, 'en', ...segments), es: localizedPath(key, 'es', ...segments) };
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES[this.lang()];
    let value = dict[key] ?? DICTIONARIES.en[key] ?? key;

    if (params) {
      for (const [param, paramValue] of Object.entries(params)) {
        value = value.replace(`{{${param}}}`, String(paramValue));
      }
    }

    return value;
  }
}
