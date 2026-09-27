import { TestBed } from '@angular/core/testing';
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
    address: 'Calle 1, Centro, Puebla',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 150,
    hasHeatingCooling: false,
    imageUrls: ['a.jpg', 'b.jpg'],
    ownerId: 'owner-1',
    createdAt: '2026-01-01T00:00:00Z'
  };

  function createComponent(): ListingCardComponent {
    TestBed.configureTestingModule({
      imports: [ListingCardComponent],
      providers: [provideRouter([])]
    });
    const fixture = TestBed.createComponent(ListingCardComponent);
    fixture.componentInstance.listing = listing;
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts on the first image and showImage() switches the active index', () => {
    const component = createComponent();
    expect(component.activeImageIndex()).toBe(0);

    component.showImage(1);

    expect(component.activeImageIndex()).toBe(1);
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
