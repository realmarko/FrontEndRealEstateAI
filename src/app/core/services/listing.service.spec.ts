import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ListingService } from './listing.service';
import { ListingDto } from './listing-api.adapter';
import { PagedResult } from '../models/paged-result.model';
import { ListingInput } from '../models/listing.model';

describe('ListingService', () => {
  let service: ListingService;
  let httpMock: HttpTestingController;

  const makeListingDto = (overrides: Partial<ListingDto> = {}): ListingDto => ({
    id: 'l1',
    title: 'Casa en venta',
    description: 'Una casa',
    listingType: 'Sale',
    propertyType: 'House',
    status: 'Active',
    price: 1500000,
    currency: 'MXN',
    street: 'Calle Reforma 123',
    colonia: 'Centro',
    city: 'Puebla',
    state: 'Puebla',
    zipCode: '72000',
    country: 'México',
    latitude: 19.04,
    longitude: -98.2,
    bedrooms: 3,
    bathrooms: 2,
    areaSqFt: 1500,
    yearBuilt: null,
    parkingSpaces: null,
    floors: null,
    lotSizeSqm: null,
    gardenSizeSqm: null,
    hasHeatingCooling: false,
    hasRoofGarden: false,
    hoaFee: null,
    videoTourUrl: null,
    landUseZoning: null,
    landUseCategoryId: null,
    landTenure: null,
    cosCoefficient: null,
    cusCoefficient: null,
    maxHeightMeters: null,
    isFreeOfLiens: null,
    hasPropertyTaxDebt: null,
    hasWaterDebt: null,
    frontageWidthMeters: null,
    frontageDepthMeters: null,
    hasPotableWater: null,
    hasDrainage: null,
    hasElectricity: null,
    hasThreePhaseElectricity: null,
    hasTelecomService: null,
    hasVehicleAccess: null,
    hasNearbyUTurn: null,
    isCornerLot: null,
    streetFrontageCount: null,
    primaryVialidadType: null,
    lotShape: null,
    topography: null,
    isFloodRiskZone: null,
    cadastralValue: null,
    ownerId: 'owner-1',
    ownerName: 'Marco Martinez',
    ownerEmail: 'owner@example.com',
    ownerCompany: null,
    ownerPhotoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    imageUrls: [],
    viewCount: 0,
    ...overrides
  });

  const emptyPage = (): PagedResult<ListingDto> => ({ items: [], page: 1, pageSize: 100, totalCount: 0 });

  const minimalInput: ListingInput = {
    title: 'Casa en venta',
    description: 'Una casa',
    price: 1500000,
    currency: 'MXN',
    type: 'sale',
    propertyType: 'house',
    street: 'Calle Reforma 123',
    colonia: 'Centro',
    city: 'Puebla',
    state: 'Puebla',
    zipCode: '72000',
    country: 'México',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 140,
    hasHeatingCooling: false,
    hasRoofGarden: false,
    existingImageUrls: [],
    photos: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ListingService);
    httpMock = TestBed.inject(HttpTestingController);

    // The constructor fires its own refresh() immediately on construction — settle it first so
    // it doesn't leak into (or get mistaken for) the request under test.
    httpMock.expectOne((req) => req.url === '/api/listings').flush(emptyPage());
  });

  afterEach(() => httpMock.verify());

  it('ignores a stale response that resolves after a newer refresh() call', () => {
    service.refresh();
    service.refresh();

    const reqs = httpMock.match((r) => r.url === '/api/listings');
    expect(reqs.length).toBe(2);

    // The newer call resolves first; the older call's response arrives late.
    reqs[1].flush({ items: [makeListingDto({ id: 'newer' })], page: 1, pageSize: 100, totalCount: 1 });
    reqs[0].flush({ items: [makeListingDto({ id: 'older' })], page: 1, pageSize: 100, totalCount: 1 });

    expect(service.listings().map((l) => l.id)).toEqual(['newer']);
  });

  it('sets loadError on a failed refresh() without clearing already-loaded listings', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/listings')
      .flush({ items: [makeListingDto({ id: 'l7' })], page: 1, pageSize: 100, totalCount: 1 });
    expect(service.loadError()).toBe(false);

    service.refresh();
    httpMock.expectOne((r) => r.url === '/api/listings').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.loadError()).toBe(true);
    expect(service.listings().map((l) => l.id)).toEqual(['l7']);
  });

  it('toggles loading true for the duration of the request', () => {
    expect(service.loading()).toBe(false);
    service.refresh();
    expect(service.loading()).toBe(true);

    httpMock.expectOne((r) => r.url === '/api/listings').flush(emptyPage());
    expect(service.loading()).toBe(false);
  });

  it('refresh() requests a page of 100 and populates the listings signal', () => {
    service.refresh();

    const req = httpMock.expectOne((r) => r.url === '/api/listings');
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({ items: [makeListingDto({ id: 'l7' })], page: 1, pageSize: 100, totalCount: 1 });

    expect(service.listings().map((l) => l.id)).toEqual(['l7']);
  });

  it('getById() finds a listing already loaded into the signal, or returns undefined', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/listings')
      .flush({ items: [makeListingDto({ id: 'l7' })], page: 1, pageSize: 100, totalCount: 1 });

    expect(service.getById('l7')?.id).toBe('l7');
    expect(service.getById('unknown')).toBeUndefined();
  });

  it('fetchById()/getPriceHistory()/getSimilar() hit the expected endpoints and map their DTOs', () => {
    service.fetchById('l7').subscribe((listing) => expect(listing.id).toBe('l7'));
    httpMock.expectOne('/api/listings/l7').flush(makeListingDto({ id: 'l7' }));

    service.getPriceHistory('l7').subscribe((history) => {
      expect(history).toEqual([{ price: 1400000, currency: 'MXN', recordedAt: '2025-01-01T00:00:00Z' }]);
    });
    httpMock
      .expectOne('/api/listings/l7/price-history')
      .flush([{ price: 1400000, currency: 'MXN', recordedAt: '2025-01-01T00:00:00Z' }]);

    service.getSimilar('l7').subscribe((similar) => expect(similar.map((l) => l.id)).toEqual(['l8']));
    httpMock.expectOne('/api/listings/l7/similar').flush([makeListingDto({ id: 'l8' })]);
  });

  it('create() posts multipart form data (no status field) and prepends the result to the signal', () => {
    service.create(minimalInput).subscribe();

    const req = httpMock.expectOne('/api/listings');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('Casa en venta');
    expect(body.get('city')).toBe('Puebla');
    expect(body.has('status')).toBe(false);

    req.flush(makeListingDto({ id: 'new-1' }));

    expect(service.listings().map((l) => l.id)).toEqual(['new-1']);
  });

  it('update() puts multipart form data with status=0 and replaces the matching listing', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/listings')
      .flush({ items: [makeListingDto({ id: 'l7', title: 'Old title' })], page: 1, pageSize: 100, totalCount: 1 });

    service.update('l7', minimalInput).subscribe();
    const req = httpMock.expectOne('/api/listings/l7');
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as FormData).get('status')).toBe('0');
    req.flush(makeListingDto({ id: 'l7', title: 'New title' }));

    expect(service.listings().length).toBe(1);
    expect(service.listings()[0].title).toBe('New title');
  });

  it('delete() removes the matching listing from the signal', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/listings')
      .flush({ items: [makeListingDto({ id: 'l7' })], page: 1, pageSize: 100, totalCount: 1 });

    service.delete('l7').subscribe();
    httpMock.expectOne('/api/listings/l7').flush(null);

    expect(service.listings()).toEqual([]);
  });
});
