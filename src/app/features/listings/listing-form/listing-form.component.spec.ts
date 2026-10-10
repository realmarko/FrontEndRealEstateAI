import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ListingFormComponent } from './listing-form.component';
import { ListingService } from '../../../core/services/listing.service';
import { GeomarketingService } from '../../../core/services/geomarketing.service';
import { LandUseCategoryService } from '../../../core/services/land-use-category.service';
import { TranslationService } from '../../../core/services/translation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { Listing } from '../../../core/models/listing.model';

// Resolves on a microtask, like loadGoogleMaps()'s own already-loaded fast path — never
// synchronously, so a test can grab the component reference and mutate the form (simulating the
// visitor typing ahead of a slow network reply) before the callback actually fires.
class MockGeocoder {
  static results: google.maps.GeocoderResult[] | null = [];
  static status = 'OK';

  geocode(
    _request: google.maps.GeocoderRequest,
    callback: (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => void
  ): void {
    Promise.resolve().then(() => callback(MockGeocoder.results, MockGeocoder.status as google.maps.GeocoderStatus));
  }
}

function addressComponent(longName: string, type: string): google.maps.GeocoderAddressComponent {
  return { long_name: longName, short_name: longName, types: [type] };
}

// A macrotask, so every already-scheduled microtask (loadGoogleMaps()'s .then(), the geocode
// mock's own .then()) has drained by the time this resolves.
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('ListingFormComponent', () => {
  let listingServiceSpy: jasmine.SpyObj<ListingService>;
  let geomarketingServiceSpy: jasmine.SpyObj<GeomarketingService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let errorReportingSpy: jasmine.SpyObj<ErrorReportingService>;
  let router: Router;

  const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
    id: 'l1',
    title: 'Casa existente',
    description: 'Desc',
    price: 1000000,
    currency: 'MXN',
    type: 'sale',
    propertyType: 'house',
    street: 'Calle vieja 1',
    colonia: 'Centro',
    city: 'Puebla',
    state: 'Puebla',
    zipCode: '72000',
    country: 'México',
    address: 'Calle vieja 1, Centro, Puebla',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 100,
    hasHeatingCooling: false,
    hasRoofGarden: false,
    imageUrls: ['existing.jpg'],
    ownerId: 'owner-1',
    ownerName: 'Owner Name',
    ownerEmail: 'owner@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    lat: 19.05,
    lng: -98.2,
    viewCount: 0,
    ...overrides
  });

  function createComponent(options: { editingId?: string; lat?: string; lng?: string } = {}): ListingFormComponent {
    listingServiceSpy = jasmine.createSpyObj('ListingService', ['fetchById', 'create', 'update']);
    listingServiceSpy.fetchById.and.returnValue(of(makeListing()));
    geomarketingServiceSpy = jasmine.createSpyObj('GeomarketingService', ['listStates', 'listMunicipalities']);
    geomarketingServiceSpy.listStates.and.returnValue(of([]));
    geomarketingServiceSpy.listMunicipalities.and.returnValue(of([]));
    const landUseCategoryServiceSpy = jasmine.createSpyObj('LandUseCategoryService', ['listAll'], {
      categories: signal([])
    });
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    errorReportingSpy = jasmine.createSpyObj('ErrorReportingService', ['report']);

    const queryParams: Record<string, string> = {};
    if (options.lat) queryParams['lat'] = options.lat;
    if (options.lng) queryParams['lng'] = options.lng;

    TestBed.configureTestingModule({
      imports: [ListingFormComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingServiceSpy },
        { provide: GeomarketingService, useValue: geomarketingServiceSpy },
        { provide: LandUseCategoryService, useValue: landUseCategoryServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ErrorReportingService, useValue: errorReportingSpy },
        {
          provide: TranslationService,
          useValue: jasmine.createSpyObj('TranslationService', [], { lang: () => 'es' })
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(options.editingId ? { id: options.editingId } : {}),
              queryParamMap: convertToParamMap(queryParams)
            }
          }
        }
      ]
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    return TestBed.createComponent(ListingFormComponent).componentInstance;
  }

  function makeFile(name = 'photo.jpg'): File {
    return new File(['x'], name, { type: 'image/jpeg' });
  }

  it('create mode: does not fetch an existing listing', () => {
    const component = createComponent();
    expect(component.isEditMode).toBe(false);
    expect(listingServiceSpy.fetchById).not.toHaveBeenCalled();
  });

  it('edit mode: fetches and patches the form from the existing listing', () => {
    const component = createComponent({ editingId: 'l1' });

    expect(component.isEditMode).toBe(true);
    expect(listingServiceSpy.fetchById).toHaveBeenCalledWith('l1');
    expect(component.form.controls.title.value).toBe('Casa existente');
    expect(component.form.controls.street.value).toBe('Calle vieja 1');
    expect(component.existingImageUrls()).toEqual(['existing.jpg']);
  });

  describe('reverse-geocode autofill', () => {
    let originalGoogle: unknown;

    beforeEach(() => {
      originalGoogle = (window as unknown as { google?: unknown }).google;
      (window as unknown as { google: unknown }).google = { maps: { Geocoder: MockGeocoder } };
      MockGeocoder.status = 'OK';
      MockGeocoder.results = [
        {
          address_components: [
            addressComponent('Reforma', 'route'),
            addressComponent('123', 'street_number'),
            addressComponent('Centro', 'sublocality_level_1'),
            addressComponent('Ciudad de México', 'locality'),
            addressComponent('Ciudad de México', 'administrative_area_level_1'),
            addressComponent('04470', 'postal_code')
          ]
        } as unknown as google.maps.GeocoderResult
      ];
    });

    afterEach(() => {
      (window as unknown as { google: unknown }).google = originalGoogle;
    });

    it('fills every empty address field from the geocoded result, including overwriting the Puebla default state', async () => {
      const component = createComponent({ lat: '19.4326', lng: '-99.1332' });
      await flushMicrotasks();

      expect(component.form.controls.street.value).toBe('Reforma 123');
      expect(component.form.controls.colonia.value).toBe('Centro');
      expect(component.form.controls.city.value).toBe('Ciudad de México');
      expect(component.form.controls.state.value).toBe('Ciudad de México');
      expect(component.form.controls.zipCode.value).toBe('04470');
    });

    it('never overwrites a field the visitor already typed into before the geocode result arrives', async () => {
      const component = createComponent({ lat: '19.4326', lng: '-99.1332' });
      // The mock geocoder's callback is still pending on a microtask at this point — set the
      // field now, exactly like a visitor typing ahead of a slow network reply.
      component.form.controls.street.setValue('Owner typed this');

      await flushMicrotasks();

      expect(component.form.controls.street.value).toBe('Owner typed this');
    });

    it('does nothing when the geocoder returns no results', async () => {
      MockGeocoder.status = 'ZERO_RESULTS';
      MockGeocoder.results = null;

      const component = createComponent({ lat: '19.4326', lng: '-99.1332' });
      await flushMicrotasks();

      expect(component.form.controls.street.value).toBe('');
      expect(component.form.controls.state.value).toBe('Puebla');
    });
  });

  it('isLandOrCommercial()/isPureLand() classify the selected property type', () => {
    const component = createComponent();

    component.form.controls.propertyType.setValue('house');
    expect(component.isLandOrCommercial()).toBe(false);
    expect(component.isPureLand()).toBe(false);

    component.form.controls.propertyType.setValue('commercial');
    expect(component.isLandOrCommercial()).toBe(true);
    expect(component.isPureLand()).toBe(false);

    component.form.controls.propertyType.setValue('land');
    expect(component.isLandOrCommercial()).toBe(true);
    expect(component.isPureLand()).toBe(true);
  });

  it('onFilesSelected() reads every selected file, preserves selection order, and resets the input', (done) => {
    const component = createComponent();
    const input = document.createElement('input');
    input.type = 'file';
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(makeFile('first.jpg'));
    dataTransfer.items.add(makeFile('second.jpg'));
    input.files = dataTransfer.files;

    component.onFilesSelected({ target: input } as unknown as Event);

    setTimeout(() => {
      expect(component.newPhotos().map((p) => p.file.name)).toEqual(['first.jpg', 'second.jpg']);
      expect(input.value).toBe('');
      done();
    }, 50);
  });

  it('removeImage() removes from existingImageUrls or newPhotos depending on the index', () => {
    const component = createComponent({ editingId: 'l1' });
    component.newPhotos.set([{ file: makeFile('new.jpg'), previewUrl: 'data:new' }]);
    expect(component.displayImages()).toEqual(['existing.jpg', 'data:new']);

    component.removeImage(1);
    expect(component.displayImages()).toEqual(['existing.jpg']);

    component.removeImage(0);
    expect(component.displayImages()).toEqual([]);
  });

  describe('submit()', () => {
    function fillMinimumValidForm(component: ListingFormComponent): void {
      component.form.patchValue({
        title: 'Nueva propiedad',
        description: 'Descripción',
        price: 500000,
        city: 'Puebla',
        street: 'Calle 1',
        areaSqm: 120
      });
      component.existingImageUrls.set(['photo.jpg']);
    }

    it('blocks submission and shows an error when the form is invalid', () => {
      const component = createComponent();

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.formHasErrors');
      expect(listingServiceSpy.create).not.toHaveBeenCalled();
    });

    it('blocks submission when the form is valid but has no photos', () => {
      const component = createComponent();
      component.form.patchValue({ title: 'T', description: 'D', price: 1, city: 'Puebla', street: 'S', areaSqm: 1 });

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.atLeastOnePhoto');
      expect(listingServiceSpy.create).not.toHaveBeenCalled();
    });

    it('zeroes/undefines residential-only fields for a land-or-commercial property type', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(of(makeListing()));
      fillMinimumValidForm(component);
      component.form.patchValue({ propertyType: 'commercial', bedrooms: 3, bathrooms: 2, gardenSizeSqm: 50, hoaFee: 100 });

      component.submit();

      const sentValue = listingServiceSpy.create.calls.mostRecent().args[0];
      expect(sentValue.bedrooms).toBe(0);
      expect(sentValue.bathrooms).toBe(0);
      expect(sentValue.gardenSizeSqm).toBeUndefined();
      expect(sentValue.hoaFee).toBeUndefined();
    });

    it('additionally undefines structure-only fields for a pure-land property type', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(of(makeListing()));
      fillMinimumValidForm(component);
      component.form.patchValue({
        propertyType: 'land',
        yearBuilt: 2020,
        parkingSpaces: 2,
        floors: 1,
        hasHeatingCooling: true,
        hasRoofGarden: true
      });

      component.submit();

      const sentValue = listingServiceSpy.create.calls.mostRecent().args[0];
      expect(sentValue.yearBuilt).toBeUndefined();
      expect(sentValue.parkingSpaces).toBeUndefined();
      expect(sentValue.floors).toBeUndefined();
      expect(sentValue.hasHeatingCooling).toBe(false);
      expect(sentValue.hasRoofGarden).toBe(false);
    });

    it('create mode: calls create(), notifies, and navigates to the new listing', () => {
      const component = createComponent();
      const created = makeListing({ id: 'new-1' });
      listingServiceSpy.create.and.returnValue(of(created));
      fillMinimumValidForm(component);

      component.submit();

      expect(listingServiceSpy.create).toHaveBeenCalled();
      expect(listingServiceSpy.update).not.toHaveBeenCalled();
      expect(notificationSpy.success).toHaveBeenCalledWith('listingForm.createSuccess');
      expect(router.navigate).toHaveBeenCalledWith(['/listings', 'new-1']);
      expect(component.isSubmitting()).toBe(false);
    });

    it('edit mode: calls update() with the editing id and the updateSuccess message', () => {
      const component = createComponent({ editingId: 'l1' });
      listingServiceSpy.update.and.returnValue(of(makeListing()));
      fillMinimumValidForm(component);

      component.submit();

      expect(listingServiceSpy.update).toHaveBeenCalledWith('l1', jasmine.any(Object));
      expect(notificationSpy.success).toHaveBeenCalledWith('listingForm.updateSuccess');
    });

    it('ignores a second submit() while the first request is still in flight', () => {
      const component = createComponent();
      const subject = new Subject<Listing>();
      listingServiceSpy.create.and.returnValue(subject.asObservable());
      fillMinimumValidForm(component);

      component.submit();
      component.submit();

      expect(listingServiceSpy.create).toHaveBeenCalledTimes(1);
    });

    it('maps a 401 to the generic submit error, since the auth interceptor already handles session expiry', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(throwError(() => ({ status: 401 })));
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.submitError');
      expect(errorReportingSpy.report).toHaveBeenCalled();
    });

    it('maps a 403 to the forbidden/not-an-Owner message, without reporting it', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(throwError(() => ({ status: 403 })));
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.forbiddenError');
      expect(errorReportingSpy.report).not.toHaveBeenCalled();
    });

    it('maps a 502 to the photo-upload error message', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(throwError(() => ({ status: 502 })));
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.photoUploadError');
    });

    it('maps a 400 with the photo-type message to photoTypeError', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(
        throwError(() => ({ status: 400, error: { message: 'Photos must be JPEG, PNG, or WEBP images.' } }))
      );
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.photoTypeError');
    });

    it('maps a 400 with the photo-size message to photoSizeError', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(
        throwError(() => ({ status: 400, error: { message: 'Each photo must be 5 MB or smaller.' } }))
      );
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.photoSizeError');
    });

    it('falls back to a generic submitError for anything else, and reports it for the admin error log', () => {
      const component = createComponent();
      listingServiceSpy.create.and.returnValue(
        throwError(() => ({ status: 500, statusText: 'Internal Server Error', url: '/api/listings' }))
      );
      fillMinimumValidForm(component);

      component.submit();

      expect(notificationSpy.error).toHaveBeenCalledWith('listingForm.submitError');
      expect(errorReportingSpy.report).toHaveBeenCalledWith(
        'HTTP 500 Internal Server Error for /api/listings (listing create)'
      );
      expect(component.isSubmitting()).toBe(false);
    });
  });
});
