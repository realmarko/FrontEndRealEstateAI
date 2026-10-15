import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { ListingService } from '../../../core/services/listing.service';
import { Agency } from '../../../core/models/agency.model';
import { Listing, ListingType } from '../../../core/models/listing.model';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { QrCodeModalComponent } from '../../../shared/components/qr-code-modal/qr-code-modal.component';
import { WhatsAppButtonComponent } from '../../../shared/components/whatsapp-button/whatsapp-button.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { SeoService } from '../../../core/services/seo.service';
import { toSlug } from '../../../core/services/brokerage-api.adapter';

@Component({
  selector: 'app-agency-detail',
  standalone: true,
  imports: [RouterLink, ListingGridComponent, TranslatePipe, QrCodeModalComponent, WhatsAppButtonComponent],
  templateUrl: './agency-detail.component.html',
  styleUrl: './agency-detail.component.css'
})
export class AgencyDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly brokerageService = inject(BrokerageService);
  private readonly listingService = inject(ListingService);
  private readonly translation = inject(TranslationService);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthService);

  readonly agency = signal<Agency | null>(null);
  readonly notFound = signal(false);
  private readonly agencyListings = signal<Listing[]>([]);

  readonly showQrModal = signal(false);
  // Same slug every generated link to this brokerage already uses (see the constructor comment
  // below) — the QR has to encode that public URL, not an internal numeric-id one, since it's
  // meant to be scanned by a stranger with no session.
  readonly agencySlug = computed(() => toSlug(this.agency()?.name ?? ''));
  // window.location.origin rather than a hardcoded domain: always matches whatever origin the
  // page is actually served from (localhost, dev.espacial.com.mx, espacial.com.mx).
  readonly qrCodeUrl = computed(() => `${window.location.origin}/inmobiliarias/${this.agencySlug()}`);

  // Same filter shape as /listings (ListingListComponent) minus the company filter, which would
  // be redundant here — every listing on this page already belongs to this one agency.
  readonly typeFilter = signal<ListingType | 'all'>('all');
  readonly search = signal('');

  readonly location = computed(() => {
    const a = this.agency();
    return a ? [a.city, a.state].filter(Boolean).join(', ') : '';
  });

  readonly listings = computed(() => {
    const type = this.typeFilter();
    const term = this.search().trim().toLowerCase();

    return this.agencyListings().filter((listing) => {
      const matchesType = type === 'all' || listing.type === type;
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  });

  constructor() {
    // Every link built elsewhere in the app now points here with toSlug(name) (spaces replaced
    // with underscores — see brokerage-api.adapter.ts), not the numeric id, so the id is never
    // shown in the URL. A bare numeric param — an old bookmark/link, or a direct id someone
    // types — still resolves too, via fetchById; nothing currently generates that form on
    // purpose, but there's no reason to break it.
    const param = this.route.snapshot.paramMap.get('id') ?? '';
    const numericId = /^\d+$/.test(param) ? Number(param) : null;
    const lookup = numericId !== null ? this.brokerageService.fetchById(numericId) : this.brokerageService.fetchBySlug(param);

    lookup.subscribe({
      next: (agency) => {
        this.agency.set(agency);
        this.listingService.fetchByAgency(agency.id).subscribe((listings) => this.agencyListings.set(listings));

        this.seo.set({
          title: agency.name,
          description: agency.description
            ? agency.description
            : `Propiedades en venta y renta de ${agency.name} en Espacial.com.mx.`,
          path: `/inmobiliarias/${toSlug(agency.name)}`,
          image: agency.logoUrl
        });
      },
      error: () => this.notFound.set(true)
    });
  }

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }

  openQrModal(): void {
    this.showQrModal.set(true);
  }

  closeQrModal(): void {
    this.showQrModal.set(false);
  }

  whatsappMessage(name: string): string {
    return this.translation.t('agencyDetail.whatsappMessage', { name });
  }
}
