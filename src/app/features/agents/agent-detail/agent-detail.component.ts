import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Agent, AgentReview } from '../../../core/models/agent.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { RatingStarsComponent } from '../../../shared/components/rating-stars/rating-stars.component';

@Component({
  selector: 'app-agent-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, RatingStarsComponent, DecimalPipe, DatePipe],
  templateUrl: './agent-detail.component.html',
  styleUrl: './agent-detail.component.css'
})
export class AgentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly agentService = inject(AgentService);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  private readonly agentId = Number(this.route.snapshot.paramMap.get('id'));

  readonly agent = signal<Agent | undefined>(undefined);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => this.agent()?.isOwnProfile ?? false);

  readonly reviews = signal<AgentReview[]>([]);
  readonly selectedRating = signal(0);
  readonly reviewComment = signal('');
  readonly submittingReview = signal(false);

  readonly stars = [1, 2, 3, 4, 5];

  readonly showContactModal = signal(false);
  readonly contactName = signal('');
  readonly contactPhone = signal('');
  readonly contactEmail = signal('');
  readonly contactMessage = signal('');
  readonly sendingContact = signal(false);

  constructor() {
    this.agentService.fetchById(this.agentId).subscribe({
      next: (agent) => {
        this.agent.set(agent);
        this.loading.set(false);
      },
      error: () => {
        this.agent.set(undefined);
        this.loading.set(false);
      }
    });

    this.agentService.getReviews(this.agentId).subscribe((reviews) => this.reviews.set(reviews));
  }

  openContactModal(): void {
    const user = this.auth.currentUser();
    this.contactName.set(user ? `${user.firstName} ${user.lastName}`.trim() : '');
    this.contactEmail.set(user?.email ?? '');
    this.contactPhone.set('');
    this.contactMessage.set('');
    this.showContactModal.set(true);
  }

  closeContactModal(): void {
    if (this.sendingContact()) return;
    this.showContactModal.set(false);
  }

  sendContactMessage(): void {
    const name = this.contactName().trim();
    const phone = this.contactPhone().trim();
    const email = this.contactEmail().trim();
    const message = this.contactMessage().trim();

    if (!name || !phone || !email || !message || this.sendingContact()) {
      this.notification.error('agentDetail.contactFormIncomplete');
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
}
