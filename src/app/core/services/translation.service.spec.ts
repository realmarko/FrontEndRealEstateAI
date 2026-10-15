import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    localStorage.removeItem('reapp_lang');
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
  });

  it('translates a known key in the current language', () => {
    service.setLang('en');
    expect(service.t('landing.footerLogin')).toBe('Log in');

    service.setLang('es');
    expect(service.t('landing.footerLogin')).toBe('Iniciar sesión');
  });

  it('interpolates {{params}} into the translated string', () => {
    service.setLang('en');
    expect(
      service.t('map.opportunityCompetitorCount', { count: 5, category: 'pharmacies', radiusKm: 1 })
    ).toBe('5 pharmacies within 1 km');
  });

  it('falls back to the key itself when it exists in no dictionary', () => {
    expect(service.t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('persists the selected language across instances via localStorage', () => {
    service.setLang('es');
    expect(localStorage.getItem('reapp_lang')).toBe('es');

    // TranslationService now injects DOCUMENT/PLATFORM_ID (for SSR safety), so a fresh instance
    // must be constructed inside an injection context — a bare `new TranslationService()` throws
    // NG0203 outside one.
    const freshInstance = TestBed.runInInjectionContext(() => new TranslationService());
    expect(freshInstance.lang()).toBe('es');
  });

  // Regression guard: this service used to touch `localStorage`/`navigator`/global `document`
  // unconditionally, which threw during SSR/prerendering (none of those exist there, simulated
  // here via PLATFORM_ID: 'server').
  it('defaults to English without touching localStorage/navigator on the server platform', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }]
    });

    const serverService = TestBed.inject(TranslationService);

    expect(serverService.lang()).toBe('en');
    expect(() => serverService.setLang('es')).not.toThrow();
  });
});
