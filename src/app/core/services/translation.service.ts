import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { isBrowser } from '../utils/platform';

export type Lang = 'en' | 'es';

const LANG_KEY = 'reapp_lang';
const DICTIONARIES: Record<Lang, Record<string, string>> = { en, es };

@Injectable({ providedIn: 'root' })
export class TranslationService {
  // No localStorage/navigator exists during SSR/prerendering — defaults to 'en' at build time;
  // the real lang is restored client-side on hydration, same as AuthService's session.
  private readonly isBrowser = isBrowser();
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<Lang>(this.readInitialLang());

  constructor() {
    this.document.documentElement.lang = this.lang();
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    if (this.isBrowser) localStorage.setItem(LANG_KEY, lang);
    this.document.documentElement.lang = lang;
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
    if (!this.isBrowser) return 'en';
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
}
