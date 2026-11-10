import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { isBrowser } from '../utils/platform';
import { LogicalKey, localizedPath } from '../routing/route-slugs';

export type Lang = 'en' | 'es';

const LANG_KEY = 'reapp_lang';
const DICTIONARIES: Record<Lang, Record<string, string>> = { en, es };

@Injectable({ providedIn: 'root' })
export class TranslationService {
  // No localStorage exists during SSR/prerendering — defaults to 'es' (the site's default
  // language; see CLAUDE.md/user decision), immediately overridden below by whichever language
  // the matched route's own EN/ES slug actually carries (see core/routing/localized-route.ts).
  private readonly isBrowser = isBrowser();
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  readonly lang = signal<Lang>(this.readInitialLang());

  constructor() {
    this.document.documentElement.lang = this.lang();

    // The URL is the source of truth for language once it carries one: a dual-registered route
    // (core/routing/localized-route.ts) tags its matched Route with data.lang, so opening a
    // shared /propiedades link shows Spanish immediately — even overriding a stale localStorage
    // preference from a previous visit — while the toggle keeps working by navigating to the
    // other-language URL (see navbar.component.ts), which lands back here. Routes with no
    // data.lang (home, every authGuard-only admin/utility page) leave the signal untouched.
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      const lang = this.deepestRouteLang();
      if (lang) this.setLang(lang);
    });
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    if (this.isBrowser) localStorage.setItem(LANG_KEY, lang);
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

  private readInitialLang(): Lang {
    if (!this.isBrowser) return 'es';
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'en' || stored === 'es' ? stored : 'es';
  }

  private deepestRouteLang(): Lang | undefined {
    let snapshot = this.router.routerState.snapshot.root;
    let lang: Lang | undefined = snapshot.data['lang'] as Lang | undefined;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
      lang = (snapshot.data['lang'] as Lang | undefined) ?? lang;
    }
    return lang;
  }
}
