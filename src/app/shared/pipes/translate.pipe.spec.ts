import { TestBed } from '@angular/core/testing';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let translation: TranslationService;

  beforeEach(() => {
    localStorage.removeItem('reapp_lang');
    TestBed.configureTestingModule({});
    translation = TestBed.inject(TranslationService);
    pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
  });

  it('delegates to TranslationService.t with the key', () => {
    translation.setLang('en');
    expect(pipe.transform('landing.footerLogin')).toBe('Log in');
  });

  it('passes interpolation params through to TranslationService.t', () => {
    translation.setLang('en');
    expect(
      pipe.transform('map.opportunityCompetitorCount', { count: 3, category: 'pharmacies', radiusKm: 1 })
    ).toBe('3 pharmacies within 1 km');
  });

  it('reacts to language changes since it reads the live signal', () => {
    translation.setLang('en');
    expect(pipe.transform('landing.footerLogin')).toBe('Log in');

    translation.setLang('es');
    expect(pipe.transform('landing.footerLogin')).toBe('Iniciar sesión');
  });
});
