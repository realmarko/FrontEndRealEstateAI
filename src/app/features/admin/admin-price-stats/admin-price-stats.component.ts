import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ListingService } from '../../../core/services/listing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PricePerSqmStat } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

// Below this, a bucket's avg/median is one or two listings pretending to be a market figure —
// the UI flags it instead of just quietly showing a confident-looking number.
export const LOW_SAMPLE_THRESHOLD = 3;

@Component({
  selector: 'app-admin-price-stats',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe],
  templateUrl: './admin-price-stats.component.html',
  styleUrl: './admin-price-stats.component.css'
})
export class AdminPriceStatsComponent implements OnInit {
  readonly stats = signal<PricePerSqmStat[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  readonly saleStats = computed(() => this.stats().filter((s) => s.listingType === 'sale'));
  readonly rentStats = computed(() => this.stats().filter((s) => s.listingType === 'rent'));

  constructor(
    private readonly listingService: ListingService,
    private readonly notification: NotificationService,
    seo: SeoService
  ) {
    // noIndex not set explicitly: this route is already excluded from the sitemap and sits
    // behind authGuard + roleGuard('Admin'), same as every other admin/* page — a crawler would
    // get redirected to login before ever seeing this title.
    seo.set({ title: 'Precio por m² (admin)', description: 'Promedio y mediana de precio/m² por zona, solo para administradores.', path: '/admin/precio-m2' });
  }

  ngOnInit(): void {
    this.load();
  }

  isLowSample(count: number): boolean {
    return count < LOW_SAMPLE_THRESHOLD;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.listingService
      .getPricePerSqmStats()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.stats.set(result),
        error: () => {
          this.loadError.set(true);
          this.notification.error('adminPriceStats.loadError');
        }
      });
  }
}
