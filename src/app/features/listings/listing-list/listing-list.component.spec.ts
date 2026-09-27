import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ListingListComponent } from './listing-list.component';
import { ListingService } from '../../../core/services/listing.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { SavedSearchService } from '../../../core/services/saved-search.service';
import { SavedSearchDto } from '../../../core/services/saved-search-api.adapter';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Listing } from '../../../core/models/listing.model';

describe('ListingListComponent', () => {
  let listingServiceSpy: jasmine.SpyObj<ListingService>;
  let brokerageServiceSpy: jasmine.SpyObj<BrokerageService>;
  let savedSearchServiceSpy: jasmine.SpyObj<SavedSearchService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
    id: 'l1',
    title: 'Casa en venta',
    description: '',
    price: 1000000,
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
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 100,
    hasHeatingCooling: false,
    imageUrls: [],
    ownerId: 'owner-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  });

  function createComponent(listings: Listing[] = []): ListingListComponent {
    listingServiceSpy = jasmine.createSpyObj('ListingService', [], { listings: () => listings });
    brokerageServiceSpy = jasmine.createSpyObj('BrokerageService', ['search']);
    brokerageServiceSpy.search.and.returnValue(of(['Acme Realty']));
    savedSearchServiceSpy = jasmine.createSpyObj('SavedSearchService', ['create']);
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [ListingListComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingServiceSpy },
        { provide: BrokerageService, useValue: brokerageServiceSpy },
        { provide: SavedSearchService, useValue: savedSearchServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', [], { isAuthenticated: () => false }) }
      ]
    });

    return TestBed.createComponent(ListingListComponent).componentInstance;
  }

  it('loads brokerage names on construction', () => {
    const component = createComponent();
    expect(component.brokerages()).toEqual(['Acme Realty']);
  });

  it('filters by type, search term (title or address), and company', () => {
    const rentHouse = makeListing({ id: 'r1', type: 'rent', title: 'Depa en renta', ownerCompany: 'Acme' });
    const saleHouse = makeListing({ id: 's1', type: 'sale', title: 'Casa colonial', address: 'Av. Reforma 5' });
    const component = createComponent([rentHouse, saleHouse]);

    expect(component.listings().map((l) => l.id)).toEqual(['r1', 's1']);

    component.setTypeFilter('rent');
    expect(component.listings().map((l) => l.id)).toEqual(['r1']);

    component.setTypeFilter('all');
    component.onSearchChange('reforma');
    expect(component.listings().map((l) => l.id)).toEqual(['s1']);

    component.onSearchChange('');
    component.setCompanyFilter('acme');
    expect(component.listings().map((l) => l.id)).toEqual(['r1']);
  });

  it('saveCurrentSearch() does nothing when the name is blank', () => {
    const component = createComponent();
    component.setSaveSearchName('   ');

    component.saveCurrentSearch();

    expect(savedSearchServiceSpy.create).not.toHaveBeenCalled();
  });

  it('saveCurrentSearch() creates the search, omitting listingType for "all", then resets the form', () => {
    const component = createComponent();
    savedSearchServiceSpy.create.and.returnValue(of({} as unknown as SavedSearchDto));
    component.setSaveSearchName('My search');
    component.setTypeFilter('all');
    component.toggleSaveSearchForm();

    component.saveCurrentSearch();

    expect(savedSearchServiceSpy.create).toHaveBeenCalledWith({ name: 'My search', listingType: undefined });
    expect(notificationSpy.success).toHaveBeenCalledWith('savedSearches.saved');
    expect(component.saveSearchName()).toBe('');
    expect(component.showSaveSearchForm()).toBe(false);
  });

  it('saveCurrentSearch() includes the active type filter when it is not "all"', () => {
    const component = createComponent();
    savedSearchServiceSpy.create.and.returnValue(of({} as unknown as SavedSearchDto));
    component.setSaveSearchName('Rentals only');
    component.setTypeFilter('rent');

    component.saveCurrentSearch();

    expect(savedSearchServiceSpy.create).toHaveBeenCalledWith({ name: 'Rentals only', listingType: 'rent' });
  });

  it('saveCurrentSearch() shows an error notification on failure and keeps the form open', () => {
    const component = createComponent();
    savedSearchServiceSpy.create.and.returnValue(throwError(() => new Error('boom')));
    component.setSaveSearchName('My search');
    component.toggleSaveSearchForm();

    component.saveCurrentSearch();

    expect(notificationSpy.error).toHaveBeenCalledWith('savedSearches.saveError');
    expect(component.showSaveSearchForm()).toBe(true);
  });
});
