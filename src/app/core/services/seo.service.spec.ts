import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  afterEach(() => {
    document.querySelector('link[rel="canonical"]')?.remove();
    document.querySelector('script[data-seo-jsonld]')?.remove();
  });

  it('uses the real browser origin for canonical/og:url/structured-data urls', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(SeoService);

    expect(service.origin).toBe(document.location.origin);

    service.set({
      title: 'A listing',
      description: 'A description',
      path: '/listings/abc123',
      structuredData: { '@type': 'RealEstateListing', url: `${service.origin}/listings/abc123` }
    });

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(`${document.location.origin}/listings/abc123`);

    const jsonLd = document.querySelector('script[data-seo-jsonld]');
    expect(jsonLd?.textContent).toContain(document.location.origin);
  });

  // Regression guard: the origin used to be hardcoded to environment.siteUrl unconditionally
  // (added for build-time prerendering, where there's no real request host to read), which broke
  // QR codes/structured-data urls in the live browser on any host that didn't match the hardcoded
  // value (e.g. `ng serve` on a non-default port).
  it('falls back to environment.siteUrl only on the server platform, not in the browser', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }]
    });
    const serverService = TestBed.inject(SeoService);

    expect(serverService.origin).not.toBe(document.location.origin);
    expect(serverService.origin.startsWith('http')).toBe(true);
  });
});
