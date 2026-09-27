import { Component, OnInit, inject, signal } from '@angular/core';
import { ListingService } from '../../../core/services/listing.service';
import { ListingQuota } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

// Shown on the "new listing" form so an Owner/Agent can see how many properties they have
// left this calendar month before ListingsController.Create starts rejecting with a 400 —
// purely informational, the backend is still the source of truth for the actual limit.
@Component({
  selector: 'app-listing-quota',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './listing-quota.component.html',
  styleUrl: './listing-quota.component.css'
})
export class ListingQuotaComponent implements OnInit {
  private readonly listingService = inject(ListingService);

  readonly quota = signal<ListingQuota | null>(null);

  ngOnInit(): void {
    // Buyer-only accounts land here with no "Owner" role and get a 403 from /mine/quota —
    // that's expected (they can't create listings at all, see hasCoordinatesGuard/route), so
    // this stays silent rather than showing an error state for something the rest of the page
    // already blocks.
    this.listingService.getMyQuota().subscribe({
      next: (quota) => this.quota.set(quota)
    });
  }

  get percentUsed(): number {
    const quota = this.quota();
    if (!quota || quota.limit <= 0) return 0;
    return Math.min(100, Math.round((quota.used / quota.limit) * 100));
  }
}
