import { Injectable, signal } from '@angular/core';
import { Listing, ListingInput } from '../models/listing.model';

const LISTINGS_KEY = 'reapp_listings';

const SEED_LISTINGS: Listing[] = [
  {
    id: '1',
    title: 'Sunny 2-Bedroom Apartment',
    description: 'Bright apartment close to downtown with a private balcony.',
    price: 1450,
    currency: 'USD',
    type: 'rent',
    address: '12 Maple Street, Springfield',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 78,
    imageUrl: 'https://picsum.photos/seed/listing1/640/400',
    ownerId: 'seed',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Modern Family House',
    description: 'Spacious 4-bedroom house with a garden and garage.',
    price: 385000,
    currency: 'USD',
    type: 'sale',
    address: '48 Oak Avenue, Riverdale',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 210,
    imageUrl: 'https://picsum.photos/seed/listing2/640/400',
    ownerId: 'seed',
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Cozy Studio Near Campus',
    description: 'Perfect for students, fully furnished and walkable to campus.',
    price: 650,
    currency: 'USD',
    type: 'rent',
    address: '3 College Row, Elmwood',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 32,
    imageUrl: 'https://picsum.photos/seed/listing3/640/400',
    ownerId: 'seed',
    createdAt: new Date().toISOString()
  }
];

@Injectable({ providedIn: 'root' })
export class ListingService {
  private readonly listingsSignal = signal<Listing[]>(this.readListings());

  readonly listings = this.listingsSignal.asReadonly();

  getById(id: string): Listing | undefined {
    return this.listingsSignal().find((listing) => listing.id === id);
  }

  create(input: ListingInput, ownerId: string): Listing {
    const listing: Listing = {
      ...input,
      id: crypto.randomUUID(),
      ownerId,
      createdAt: new Date().toISOString()
    };
    const listings = [listing, ...this.listingsSignal()];
    this.listingsSignal.set(listings);
    this.writeListings(listings);
    return listing;
  }

  update(id: string, input: ListingInput): void {
    const listings = this.listingsSignal().map((listing) =>
      listing.id === id ? { ...listing, ...input } : listing
    );
    this.listingsSignal.set(listings);
    this.writeListings(listings);
  }

  delete(id: string): void {
    const listings = this.listingsSignal().filter((listing) => listing.id !== id);
    this.listingsSignal.set(listings);
    this.writeListings(listings);
  }

  private readListings(): Listing[] {
    const raw = localStorage.getItem(LISTINGS_KEY);
    if (!raw) {
      this.writeListings(SEED_LISTINGS);
      return SEED_LISTINGS;
    }
    return JSON.parse(raw) as Listing[];
  }

  private writeListings(listings: Listing[]): void {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
  }
}
