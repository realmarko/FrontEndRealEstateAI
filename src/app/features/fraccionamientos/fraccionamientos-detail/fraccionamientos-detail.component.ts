import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FraccionamientoService } from '../../../core/services/fraccionamiento.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FraccionamientoPublicDetail } from '../../../core/models/fraccionamiento.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';

function parseAmenities(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

@Component({
  selector: 'app-fraccionamientos-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, SkeletonLoaderComponent, StatePanelComponent, ListingGridComponent, ContactModalComponent],
  templateUrl: './fraccionamientos-detail.component.html',
  styleUrl: './fraccionamientos-detail.component.css'
})
export class FraccionamientosDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fraccionamientoService = inject(FraccionamientoService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  protected readonly auth = inject(AuthService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly frac = signal<FraccionamientoPublicDetail | undefined>(undefined);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly loadError = signal(false);

  readonly showContactModal = signal(false);
  readonly sendingContact = signal(false);

  constructor() {
    this.load();
  }

  get amenities(): string[] {
    return parseAmenities(this.frac()?.amenitiesJson ?? null);
  }

  get contactModalTitle(): string {
    return this.translation.t('fraccionamientoDetail.contactModalTitle', { name: this.frac()?.name ?? '' });
  }

  get contactInitialName(): string {
    const user = this.auth.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  get contactInitialEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  retry(): void {
    this.load();
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
    this.fraccionamientoService.contact(this.id, { name, phone, email, message }).subscribe({
      next: () => {
        this.sendingContact.set(false);
        this.showContactModal.set(false);
        this.notification.success('fraccionamientoDetail.contactSuccess');
      },
      error: () => {
        this.sendingContact.set(false);
        this.notification.error('fraccionamientoDetail.contactError');
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set(false);

    this.fraccionamientoService.getPublishedDetail(this.id).subscribe({
      next: (detail) => {
        this.frac.set(detail);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) this.notFound.set(true);
        else this.loadError.set(true);
      }
    });
  }
}
