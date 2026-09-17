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
    expect(service.t('map.opportunityCompetitorCount', { count: 5 })).toBe('5 pharmacies within 1 km');
  });

  it('falls back to the key itself when it exists in no dictionary', () => {
    expect(service.t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('persists the selected language across instances via localStorage', () => {
    service.setLang('es');
    expect(localStorage.getItem('reapp_lang')).toBe('es');

    const freshInstance = new TranslationService();
    expect(freshInstance.lang()).toBe('es');
  });
});
