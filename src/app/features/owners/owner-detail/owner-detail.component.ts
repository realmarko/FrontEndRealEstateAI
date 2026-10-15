import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../../../core/services/owner.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Owner } from '../../../core/models/owner.model';
import { Listing } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { TranslationService } from '../../../core/services/translation.service';
import { SeoService } from '../../../core/services/seo.service';
import { shouldRecordView } from '../../../core/utils/view-dedup';
import { toSlug } from '../../../core/services/owner-api.adapter';

// Mirrors AgentDetailComponent's shape throughout, trimmed: no reviews/specialties/company.
@Component({
  selector: 'app-owner-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ContactModalComponent, ListingGridComponent],
  templateUrl: './owner-detail.component.html',
  styleUrl: './owner-detail.component.css'
})
export class OwnerDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthService);

  // Resolved in the constructor below — every link built elsewhere now points here with
  // toSlug(name) (spaces stripped), not the numeric id; a bare numeric param (an old
  // bookmark/link) still resolves too, via fetchById. Same reasoning as AgentDetailComponent.
  private ownerId!: number;

  readonly owner = signal<Owner | undefined>(undefined);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => this.owner()?.isOwnProfile ?? false);
  readonly isAdmin = computed(() => this.auth.currentUser()?.roles.includes('Admin') ?? false);

  readonly listings = signal<Listing[]>([]);

  readonly showContactModal = signal(false);
  readonly sendingContact = signal(false);

  constructor() {
    const param = this.route.snapshot.paramMap.get('id') ?? '';
    const numericId = /^\d+$/.test(param) ? Number(param) : null;
    const lookup = numericId !== null ? this.ownerService.fetchById(numericId) : this.ownerService.fetchBySlug(param);

    lookup.subscribe({
      next: (owner) => {
        this.ownerId = owner.id;
        this.owner.set(owner);
        this.loading.set(false);

        this.seo.set({
          title: `${owner.name} - Propiedades`,
          description: `Propiedades en venta y renta publicadas por ${owner.name} en Espacial.com.mx.`,
          path: `/owners/${toSlug(owner.name)}`,
          image: owner.photoUrl,
          structuredData: {
            // Phone/email left out: both are redacted to "•••" server-side for an anonymous
            // visitor (OwnersController), same reasoning as AgentDetailComponent's.
            '@type': 'Person',
            name: owner.name,
            image: owner.photoUrl || undefined,
            url: `${window.location.origin}/owners/${toSlug(owner.name)}`
          }
        });

        this.ownerService.getListings(this.ownerId).subscribe((listings) => this.listings.set(listings));

        if (shouldRecordView(`owner_${this.ownerId}`)) {
          this.ownerService.recordView(this.ownerId).subscribe({ error: () => {} });
        }
      },
      error: () => {
        this.owner.set(undefined);
        this.loading.set(false);
      }
    });
  }

  get contactModalTitle(): string {
    return this.translation.t('ownerDetail.contactModalTitle', { name: this.owner()?.name ?? '' });
  }

  get contactInitialName(): string {
    const user = this.auth.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  get contactInitialEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  openContactModal(): void {
    this.showContactModal.set(true);
  }

  closeContactModal(): void {
    if (this.sendingContact()) return;
    this.showContactModal.set(false);
  }

  sendContactMessage(value: ContactFormValue): void {
    const { name, phone, email, message } = value;

    if (!name || !phone || !email || !message || this.sendingContact()) {
      this.notification.error('contactModal.formIncomplete');
      return;
    }

    this.sendingContact.set(true);
    this.ownerService.contactOwner(this.ownerId, { name, phone, email, message }).subscribe({
      next: () => {
        this.sendingContact.set(false);
        this.showContactModal.set(false);
        this.notification.success('ownerDetail.contactSuccess');
      },
      error: () => {
        this.sendingContact.set(false);
        this.notification.error('ownerDetail.contactError');
      }
    });
  }

  get initials(): string {
    const name = this.owner()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  deleteOwner(): void {
    this.ownerService.delete(this.ownerId).subscribe({
      next: () => {
        this.notification.success('ownerDetail.deleteSuccess');
        this.router.navigate(['/owners']);
      },
      error: () => this.notification.error('ownerDetail.deleteError')
    });
  }
}
