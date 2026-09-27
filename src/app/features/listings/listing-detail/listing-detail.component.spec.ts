import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ListingDetailComponent } from './listing-detail.component';
import { ListingService } from '../../../core/services/listing.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuthService } from '../../../core/services/auth.service';
import { InquiryService } from '../../../core/services/inquiry.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { Listing, PriceHistoryEntry } from '../../../core/models/listing.model';
import { User } from '../../../core/models/user.model';

describe('ListingDetailComponent', () => {
  let listingServiceSpy: jasmine.SpyObj<ListingService>;
  let favoritesServiceSpy: jasmine.SpyObj<FavoritesService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let inquiryServiceSpy: jasmine.SpyObj<InquiryService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let router: Router;
  // A real signal, not a plain closure — isOwner() is an Angular computed() that depends on
  // this, and computed() only re-evaluates when a genuine signal it read actually changes; a
  // plain function returning a captured variable would leave it permanently cached at whatever
  // it read on the first call.
  let currentUser = signal<User | null>(null);

  // No lat/lng on purpose — the constructor only touches the Google Maps/Places/Street View
  // APIs (location preview, nearby schools) when a listing has coordinates, and none of that is
  // exercised here; it needs a real browser, not a unit test.
  const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
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
    imageUrls: ['a.jpg', 'b.jpg', 'c.jpg'],
    ownerId: 'owner-1',
    createdAt: new Date().toISOString(),
    ...overrides
  });

  function createComponent(
    listing: Listing | null = makeListing(),
    priceHistory: PriceHistoryEntry[] = []
  ): ListingDetailComponent {
    listingServiceSpy = jasmine.createSpyObj('ListingService', ['fetchById', 'getPriceHistory', 'getSimilar', 'delete']);
    listingServiceSpy.fetchById.and.returnValue(listing ? of(listing) : throwError(() => new Error('not found')));
    listingServiceSpy.getPriceHistory.and.returnValue(of(priceHistory));
    listingServiceSpy.getSimilar.and.returnValue(of([]));

    favoritesServiceSpy = jasmine.createSpyObj('FavoritesService', ['isFavorite', 'toggle']);
    favoritesServiceSpy.isFavorite.and.returnValue(false);

    currentUser = signal<User | null>(null);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], { currentUser, isAuthenticated: () => currentUser() !== null });

    inquiryServiceSpy = jasmine.createSpyObj('InquiryService', ['create']);
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [ListingDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ListingService, useValue: listingServiceSpy },
        { provide: FavoritesService, useValue: favoritesServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InquiryService, useValue: inquiryServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        {
          provide: TranslationService,
          useValue: jasmine.createSpyObj('TranslationService', ['t'], { lang: () => 'es' })
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'l1' }) } } }
      ]
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    const fixture = TestBed.createComponent(ListingDetailComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads the listing, price history and similar listings on construction', () => {
    const component = createComponent();

    expect(component.listing()?.id).toBe('l1');
    expect(component.loading()).toBe(false);
  });

  it('clears the listing and stops loading when fetchById fails', () => {
    const component = createComponent(null);

    expect(component.listing()).toBeUndefined();
    expect(component.loading()).toBe(false);
  });

  it('videoEmbedUrl is null with no video', () => {
    const component = createComponent(makeListing({ videoTourUrl: undefined }));
    expect(component.videoEmbedUrl()).toBeNull();
  });

  it('videoEmbedUrl is null for a non-YouTube link', () => {
    const component = createComponent(makeListing({ videoTourUrl: 'https://vimeo.com/12345' }));
    expect(component.videoEmbedUrl()).toBeNull();
  });

  it('videoEmbedUrl builds a youtube.com/embed URL for a youtube.com/watch link', () => {
    const withWatch = createComponent(makeListing({ videoTourUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }));
    const watchUrl = withWatch.videoEmbedUrl() as unknown as { changingThisBreaksApplicationSecurity: string };
    expect(watchUrl.changingThisBreaksApplicationSecurity).toBe('https://www.youtube.com/embed/abcdefghijk');
  });

  it('videoEmbedUrl builds a youtube.com/embed URL for a short youtu.be link', () => {
    const withShort = createComponent(makeListing({ videoTourUrl: 'https://youtu.be/abcdefghijk' }));
    const shortUrl = withShort.videoEmbedUrl() as unknown as { changingThisBreaksApplicationSecurity: string };
    expect(shortUrl.changingThisBreaksApplicationSecurity).toBe('https://www.youtube.com/embed/abcdefghijk');
  });

  it('priceHistoryRows computes the change against the previous entry and reverses for display (newest first)', () => {
    const history: PriceHistoryEntry[] = [
      { price: 1000000, currency: 'MXN', recordedAt: '2026-01-01' },
      { price: 1100000, currency: 'MXN', recordedAt: '2026-02-01' },
      { price: 1050000, currency: 'MXN', recordedAt: '2026-03-01' }
    ];
    const component = createComponent(makeListing(), history);

    const rows = component.priceHistoryRows();
    expect(rows.map((r) => r.entry.price)).toEqual([1050000, 1100000, 1000000]);
    expect(rows[2].isFirst).toBe(true);
    expect(rows[2].change).toBe(0);
    expect(rows[1].change).toBe(100000);
    expect(rows[0].change).toBe(-50000);
  });

  it('isOwner is true only when the listing owner matches the logged-in user', () => {
    const component = createComponent(makeListing({ ownerId: 'owner-1' }));
    expect(component.isOwner()).toBe(false);

    currentUser.set({ id: 'owner-1', firstName: 'A', lastName: 'B', email: 'a@b.com', roles: ['Owner'] });
    expect(component.isOwner()).toBe(true);
  });

  it('toggleFavorite() delegates to FavoritesService with this listing id', () => {
    const component = createComponent();
    component.toggleFavorite();
    expect(favoritesServiceSpy.toggle).toHaveBeenCalledWith('l1');
  });

  it('shortId() returns the first 8 characters uppercased', () => {
    const component = createComponent();
    expect(component.shortId('abcdef1234567890')).toBe('ABCDEF12');
  });

  it('pricePerSqm() divides price by area, or returns 0 for a zero-area listing', () => {
    const component = createComponent();
    expect(component.pricePerSqm(makeListing({ price: 1500000, areaSqm: 150 }))).toBe(10000);
    expect(component.pricePerSqm(makeListing({ price: 1500000, areaSqm: 0 }))).toBe(0);
  });

  it('daysOnMarket() floors the elapsed days and never goes negative on clock skew', () => {
    const component = createComponent();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(component.daysOnMarket(makeListing({ createdAt: twoDaysAgo }))).toBe(2);

    const inTheFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(component.daysOnMarket(makeListing({ createdAt: inTheFuture }))).toBe(0);
  });

  it('nextPhoto()/previousPhoto() wrap around with multiple photos', () => {
    const component = createComponent(makeListing({ imageUrls: ['a.jpg', 'b.jpg'] }));
    expect(component.activePhotoIndex()).toBe(0);

    component.nextPhoto();
    expect(component.activePhotoIndex()).toBe(1);
    component.nextPhoto();
    expect(component.activePhotoIndex()).toBe(0);

    component.previousPhoto();
    expect(component.activePhotoIndex()).toBe(1);
  });

  it('nextPhoto() does nothing with fewer than 2 photos', () => {
    const single = createComponent(makeListing({ imageUrls: ['only.jpg'] }));
    single.nextPhoto();
    expect(single.activePhotoIndex()).toBe(0);
  });

  it('deleteListing() notifies and navigates to /listings on success', () => {
    const component = createComponent();
    listingServiceSpy.delete.and.returnValue(of(undefined));

    component.deleteListing();

    expect(notificationSpy.success).toHaveBeenCalledWith('listingDetail.deleteSuccess');
    expect(router.navigate).toHaveBeenCalledWith(['/listings']);
  });

  it('deleteListing() shows an error notification on failure', () => {
    const component = createComponent();
    listingServiceSpy.delete.and.returnValue(throwError(() => new Error('boom')));

    component.deleteListing();

    expect(notificationSpy.error).toHaveBeenCalledWith('listingDetail.deleteError');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sendMessage() is a no-op with no logged-in user, or with a blank body', () => {
    const component = createComponent();
    component.messageBody.set('Hello');
    component.sendMessage();
    expect(inquiryServiceSpy.create).not.toHaveBeenCalled();

    currentUser.set({ id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.com', roles: ['Buyer'] });
    component.messageBody.set('   ');
    component.sendMessage();
    expect(inquiryServiceSpy.create).not.toHaveBeenCalled();
  });

  it('sendMessage() submits the inquiry and clears the body on success', () => {
    const component = createComponent(makeListing({ id: 'l1' }));
    inquiryServiceSpy.create.and.returnValue(of(undefined));
    currentUser.set({ id: 'u1', firstName: 'Ana', lastName: 'Lopez', email: 'ana@example.com', roles: ['Buyer'] });
    component.messageBody.set('Is this still available?');

    component.sendMessage();

    expect(inquiryServiceSpy.create).toHaveBeenCalledWith({
      listingId: 'l1',
      senderName: 'Ana Lopez',
      senderEmail: 'ana@example.com',
      message: 'Is this still available?'
    });
    expect(notificationSpy.success).toHaveBeenCalledWith('listingDetail.messageSent');
    expect(component.messageBody()).toBe('');
    expect(component.sendingMessage()).toBe(false);
  });

  it('sendMessage() keeps the typed body and shows an error notification on failure', () => {
    const component = createComponent();
    inquiryServiceSpy.create.and.returnValue(throwError(() => new Error('boom')));
    currentUser.set({ id: 'u1', firstName: 'Ana', lastName: 'Lopez', email: 'ana@example.com', roles: ['Buyer'] });
    component.messageBody.set('Is this still available?');

    component.sendMessage();

    expect(notificationSpy.error).toHaveBeenCalledWith('listingDetail.messageError');
    expect(component.messageBody()).toBe('Is this still available?');
    expect(component.sendingMessage()).toBe(false);
  });

  it('sendContactAgentMessage() rejects an incomplete form without opening a request', () => {
    const component = createComponent();

    component.sendContactAgentMessage({ name: '', phone: '222', email: 'a@b.com', message: 'hi' });

    expect(inquiryServiceSpy.create).not.toHaveBeenCalled();
    expect(notificationSpy.error).toHaveBeenCalledWith('contactModal.formIncomplete');
  });

  it('sendContactAgentMessage() submits and closes the modal on success', () => {
    const component = createComponent(makeListing({ id: 'l1' }));
    inquiryServiceSpy.create.and.returnValue(of(undefined));
    component.openContactModal();

    component.sendContactAgentMessage({ name: 'Ana', phone: '2221234567', email: 'ana@example.com', message: 'Interested' });

    expect(inquiryServiceSpy.create).toHaveBeenCalledWith({
      listingId: 'l1',
      senderName: 'Ana',
      senderEmail: 'ana@example.com',
      senderPhone: '2221234567',
      message: 'Interested',
      fundingMethod: undefined,
      timeline: undefined,
      hasAgent: undefined
    });
    expect(component.showContactModal()).toBe(false);
  });

  it('closeContactModal() is ignored while a contact message is being sent', () => {
    const component = createComponent();
    component.openContactModal();
    component.sendingContact.set(true);

    component.closeContactModal();

    expect(component.showContactModal()).toBe(true);
  });
});
