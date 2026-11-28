import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
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

  it('defaults every fresh instance to Spanish (the site is Spanish-only)', () => {
    // TranslationService injects DOCUMENT, so a fresh instance must be constructed inside an
    // injection context — a bare `new TranslationService()` throws NG0203 outside one.
    const freshInstance = TestBed.runInInjectionContext(() => new TranslationService());
    expect(freshInstance.lang()).toBe('es');
  });
});
