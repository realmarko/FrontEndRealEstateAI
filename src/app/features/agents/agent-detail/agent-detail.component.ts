import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Agent, AgentReview } from '../../../core/models/agent.model';
import { Listing } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { RatingStarsComponent } from '../../../shared/components/rating-stars/rating-stars.component';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { QrCodeModalComponent } from '../../../shared/components/qr-code-modal/qr-code-modal.component';
import { WhatsAppButtonComponent } from '../../../shared/components/whatsapp-button/whatsapp-button.component';
import { TranslationService } from '../../../core/services/translation.service';
import { shouldRecordView } from '../../../core/utils/view-dedup';
import { toSlug } from '../../../core/services/agent-api.adapter';

@Component({
  selector: 'app-agent-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, RatingStarsComponent, DecimalPipe, DatePipe, ContactModalComponent, ListingGridComponent, QrCodeModalComponent, WhatsAppButtonComponent],
  templateUrl: './agent-detail.component.html',
  styleUrl: './agent-detail.component.css'
})
export class AgentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agentService = inject(AgentService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  protected readonly auth = inject(AuthService);

  // Resolved in the constructor below, before any other agentService call that needs it — every
  // link built elsewhere in the app now points here with toSlug(name) (spaces stripped — see
  // agent-api.adapter.ts), not the numeric id, so the id is never shown in the URL. A bare
  // numeric param (an old bookmark/link) still resolves too, via fetchById.
  private agentId!: number;

  readonly agent = signal<Agent | undefined>(undefined);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => this.agent()?.isOwnProfile ?? false);
  readonly isAdmin = computed(() => this.auth.currentUser()?.roles.includes('Admin') ?? false);

  readonly listings = signal<Listing[]>([]);

  readonly reviews = signal<AgentReview[]>([]);
  readonly selectedRating = signal(0);
  readonly reviewComment = signal('');
  readonly submittingReview = signal(false);

  readonly stars = [1, 2, 3, 4, 5];

  readonly showContactModal = signal(false);
  readonly sendingContact = signal(false);
  readonly showQrModal = signal(false);

  // The same slug every generated link to this agent already uses (see the class comment
  // above) — the QR has to encode that public URL, not an internal numeric-id one, since it's
  // meant to be scanned by a stranger with no session.
  readonly agentSlug = computed(() => toSlug(this.agent()?.name ?? ''));
  // window.location.origin rather than a hardcoded domain: always matches whatever origin the
  // page is actually served from (localhost, dev.espacial.com.mx, espacial.com.mx), so the same
  // code produces a correct, scannable QR in every environment without an environment.ts lookup.
  readonly qrCodeUrl = computed(() => `${window.location.origin}/agents/${this.agentSlug()}`);

  constructor() {
    const param = this.route.snapshot.paramMap.get('id') ?? '';
    const numericId = /^\d+$/.test(param) ? Number(param) : null;
    const lookup = numericId !== null ? this.agentService.fetchById(numericId) : this.agentService.fetchBySlug(param);

    lookup.subscribe({
      next: (agent) => {
        this.agentId = agent.id;
        this.agent.set(agent);
        this.loading.set(false);

        this.agentService.getReviews(this.agentId).subscribe((reviews) => this.reviews.set(reviews));
        this.agentService.getListings(this.agentId).subscribe((listings) => this.listings.set(listings));

        if (shouldRecordView(`agent_${this.agentId}`)) {
          this.agentService.recordView(this.agentId).subscribe({ error: () => {} });
        }
      },
      error: () => {
        this.agent.set(undefined);
        this.loading.set(false);
      }
    });
  }

  get contactModalTitle(): string {
    return this.translation.t('agentDetail.contactModalTitle', { name: this.agent()?.name ?? '' });
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
    this.agentService.contactAgent(this.agentId, { name, phone, email, message }).subscribe({
      next: () => {
        this.sendingContact.set(false);
        this.showContactModal.set(false);
        this.notification.success('agentDetail.contactSuccess');
      },
      error: () => {
        this.sendingContact.set(false);
        this.notification.error('agentDetail.contactError');
      }
    });
  }

  whatsappMessage(name: string): string {
    return this.translation.t('agentDetail.whatsappMessage', { name });
  }

  openQrModal(): void {
    this.showQrModal.set(true);
  }

  closeQrModal(): void {
    this.showQrModal.set(false);
  }

  get initials(): string {
    const name = this.agent()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  submitReview(): void {
    if (this.selectedRating() < 1 || this.submittingReview()) {
      this.notification.error('agentDetail.reviewRatingRequired');
      return;
    }

    const comment = this.reviewComment().trim();
    if (comment.length > 1000) {
      this.notification.error('agentDetail.reviewCommentTooLong');
      return;
    }

    this.submittingReview.set(true);
    this.agentService.addReview(this.agentId, this.selectedRating(), comment || undefined).subscribe({
      next: (review) => {
        this.reviews.update((list) => [review, ...list]);
        this.selectedRating.set(0);
        this.reviewComment.set('');
        this.submittingReview.set(false);
        this.notification.success('agentDetail.reviewSuccess');
        this.agentService.fetchById(this.agentId).subscribe((agent) => this.agent.set(agent));
      },
      error: (err) => {
        this.submittingReview.set(false);
        const key =
          err.status === 409
            ? 'agentDetail.reviewAlreadyExists'
            : err.status === 400 && err.error?.message === "You can't review your own agent profile."
              ? 'agentDetail.reviewOwnProfile'
              : 'agentDetail.reviewError';
        this.notification.error(key);
      }
    });
  }

  deleteReview(reviewId: number): void {
    this.agentService.deleteReview(this.agentId, reviewId).subscribe({
      next: () => {
        this.reviews.update((list) => list.filter((r) => r.id !== reviewId));
        this.notification.success('agentDetail.reviewDeleted');
        this.agentService.fetchById(this.agentId).subscribe((agent) => this.agent.set(agent));
        this.agentService.refresh();
      },
      error: () => this.notification.error('agentDetail.reviewDeleteError')
    });
  }

  deleteAgent(): void {
    this.agentService.delete(this.agentId).subscribe({
      next: () => {
        this.notification.success('agentDetail.deleteSuccess');
        this.router.navigate(['/agents']);
      },
      error: () => this.notification.error('agentDetail.deleteError')
    });
  }
}
