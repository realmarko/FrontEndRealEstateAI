import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ListingCardComponent } from './listing-card.component';
import { Listing } from '../../../core/models/listing.model';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../../shared/utils/mortgage';

describe('ListingCardComponent', () => {
  const listing: Listing = {
    id: 'l1',
    title: 'Casa en venta',
    description: '',
    price: 2000000,
    currency: 'MXN',
    type: 'sale',
    propertyType: 'house',
    street: 'Calle 1',
    colonia: 'Centro',
    city: 'Puebla',
    state: 'Puebla',
    zipCode: '72000',
    country: 'México',
    hideAgentContact: false,
    address: 'Calle 1, Centro, Puebla',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 150,
    hasHeatingCooling: false,
    hasRoofGarden: false,
    imageUrls: ['a.jpg', 'b.jpg'],
    ownerId: 'owner-1',
    ownerName: 'Owner Name',
    ownerEmail: 'owner@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    viewCount: 0
  };

  function createComponent(): ListingCardComponent {
    TestBed.configureTestingModule({
      imports: [ListingCardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    const fixture = TestBed.createComponent(ListingCardComponent);
    fixture.componentInstance.listing = listing;
    fixture.detectChanges();

    // LandUseCategoryService fetches its catalog once, eagerly, from its constructor — flush
    // that request so it doesn't leak as a pending call into the next test.
    TestBed.inject(HttpTestingController).expectOne('/api/land-use-categories').flush([]);

    return fixture.componentInstance;
  }

  it('starts on the first image and showImage() switches the active index', () => {
    const component = createComponent();
    expect(component.activeImageIndex()).toBe(0);

    component.showImage(1);

    expect(component.activeImageIndex()).toBe(1);
  });

  // Real-device swipes drift diagonally, so touchmove — which is what actually classifies and
  // locks the gesture as horizontal — has to fire before touchend for a swipe to register at all.
  function touch(clientX: number, clientY = 100): Touch {
    return { clientX, clientY } as unknown as Touch;
  }

  function swipe(component: ListingCardComponent, fromX: number, toX: number): void {
    component.onGalleryTouchStart({ touches: [touch(fromX)] } as unknown as TouchEvent);
    component.onGalleryTouchMove({ touches: [touch(toX)], preventDefault: () => {} } as unknown as TouchEvent);
    component.onGalleryTouchEnd({ changedTouches: [touch(toX)] } as unknown as TouchEvent);
  }

  it('a leftward swipe advances to the next image, a rightward swipe goes back', fakeAsync(() => {
    const component = createComponent();

    swipe(component, 200, 120);
    tick(component.SNAP_DURATION_MS);
    expect(component.activeImageIndex()).toBe(1);

    swipe(component, 120, 200);
    tick(component.SNAP_DURATION_MS);
    expect(component.activeImageIndex()).toBe(0);
  }));

  it('mid-drag, the photo track follows the finger and previews the next image', () => {
    const component = createComponent();

    component.onGalleryTouchStart({ touches: [touch(200)], currentTarget: { getBoundingClientRect: () => ({ width: 300 }) } } as unknown as TouchEvent);
    component.onGalleryTouchMove({ touches: [touch(150)], preventDefault: () => {} } as unknown as TouchEvent);

    expect(component.dragOffsetPx()).toBe(-50);
    expect(component.dragNeighborIndex()).toBe(1);
    expect(component.isSnapping()).toBe(false);
  });

  it('a new swipe starting mid-snap settles the previous one immediately instead of it firing later on stale state', fakeAsync(() => {
    const component = createComponent();

    swipe(component, 200, 120); // crosses the threshold, schedules the snap to index 1
    expect(component.activeImageIndex()).toBe(0); // not settled yet — still mid-animation

    component.onGalleryTouchStart({ touches: [touch(200)] } as unknown as TouchEvent);
    expect(component.activeImageIndex()).toBe(1); // settled immediately, not left dangling
    expect(component.isSnapping()).toBe(false);

    // fakeAsync fails the test if any timer is still queued at the end — this also proves the
    // first gesture's timer didn't survive to fire a second time on top of the new one.
    tick(component.SNAP_DURATION_MS);
    expect(component.activeImageIndex()).toBe(1);
  }));

  it('a swipe that clears the threshold settles onto the neighbor only after the snap finishes', fakeAsync(() => {
    const component = createComponent();

    swipe(component, 200, 120);
    expect(component.activeImageIndex()).toBe(0); // still the old image mid-animation
    expect(component.isSnapping()).toBe(true);

    tick(component.SNAP_DURATION_MS);
    expect(component.activeImageIndex()).toBe(1);
    expect(component.isSnapping()).toBe(false);
    expect(component.dragOffsetPx()).toBe(0);
    expect(component.dragNeighborIndex()).toBeNull();
  }));

  it('a short drag below the swipe threshold does not change the image', () => {
    const component = createComponent();

    swipe(component, 200, 185);

    expect(component.activeImageIndex()).toBe(0);
  });

  it('a mostly-vertical drag is treated as page scroll and does not change the image', () => {
    const component = createComponent();

    component.onGalleryTouchStart({ touches: [{ clientX: 200, clientY: 100 }] } as unknown as TouchEvent);
    component.onGalleryTouchMove({ touches: [{ clientX: 150, clientY: 250 }], preventDefault: () => {} } as unknown as TouchEvent);
    component.onGalleryTouchEnd({ changedTouches: [{ clientX: 100, clientY: 400 }] } as unknown as TouchEvent);

    expect(component.activeImageIndex()).toBe(0);
  });

  it('a touchcancel (e.g. the browser taking over for a native scroll) discards the swipe', () => {
    const component = createComponent();

    component.onGalleryTouchStart({ touches: [touch(200)] } as unknown as TouchEvent);
    component.onGalleryTouchMove({ touches: [touch(120)], preventDefault: () => {} } as unknown as TouchEvent);
    component.onGalleryTouchCancel();
    component.onGalleryTouchEnd({ changedTouches: [touch(80)] } as unknown as TouchEvent);

    expect(component.activeImageIndex()).toBe(0);
  });

  it('estimatedMonthlyPayment matches the shared calculator with the card default assumptions', () => {
    const component = createComponent();

    const expected = calculateMonthlyPayment(
      listing.price,
      DEFAULT_DOWN_PAYMENT_PERCENT,
      DEFAULT_INTEREST_RATE_PERCENT,
      DEFAULT_TERM_YEARS
    );
    expect(component.estimatedMonthlyPayment).toBeCloseTo(expected, 6);
  });

  it('toggleFavorite emits the listing id', () => {
    const component = createComponent();
    const emitted: string[] = [];
    component.toggleFavorite.subscribe((id) => emitted.push(id));

    component.toggleFavorite.emit(component.listing.id);

    expect(emitted).toEqual(['l1']);
  });
});
