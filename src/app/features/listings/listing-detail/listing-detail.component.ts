import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingService } from '../../../core/services/listing.service';
import { MessageService } from '../../../core/services/message.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Listing } from '../../../core/models/listing.model';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, TranslatePipe],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css'
})
export class ListingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  protected readonly favorites = inject(FavoritesService);
  protected readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly notification = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly listing = signal<Listing | undefined>(undefined);
  readonly loading = signal(true);
  readonly isFavorite = computed(() => this.favorites.isFavorite(this.id));
  readonly isOwner = computed(() => this.listing()?.ownerId === this.auth.currentUser()?.id);
  readonly messageBody = signal('');

  constructor() {
    this.listingService.fetchById(this.id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);
      },
      error: () => {
        this.listing.set(undefined);
        this.loading.set(false);
      }
    });
  }

  toggleFavorite(): void {
    this.favorites.toggle(this.id);
  }

  deleteListing(): void {
    this.listingService.delete(this.id).subscribe({
      next: () => {
        this.notification.success('listingDetail.deleteSuccess');
        this.router.navigate(['/listings']);
      },
      error: () => this.notification.error('listingDetail.deleteError')
    });
  }

  sendMessage(): void {
    const listing = this.listing();
    const user = this.auth.currentUser();
    const body = this.messageBody().trim();
    if (!listing || !user || !body) {
      return;
    }

    this.messageService.sendMessage(
      listing.id,
      listing.title,
      user.id,
      `${user.firstName} ${user.lastName}`,
      body
    );
    this.messageBody.set('');
    this.notification.success('listingDetail.messageSent');
  }
}
