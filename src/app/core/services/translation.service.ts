import { Injectable, signal } from '@angular/core';
import { en } from '../i18n/en';
import { es } from '../i18n/es';

export type Lang = 'en' | 'es';

const LANG_KEY = 'reapp_lang';
const DICTIONARIES: Record<Lang, Record<string, string>> = { en, es };

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly lang = signal<Lang>(this.readInitialLang());

  constructor() {
    document.documentElement.lang = this.lang();
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
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
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
}
