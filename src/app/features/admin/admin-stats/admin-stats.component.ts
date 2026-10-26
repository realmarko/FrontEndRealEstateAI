import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { PageViewService } from '../../../core/services/page-view.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WeeklyPageViews } from '../../../core/models/page-view.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

// Route patterns a human can actually read — PathPattern is Angular's own routeConfig.path
// string (see app.ts), so this mirrors app.routes.ts's path list. Not exhaustive on purpose:
// anything missing just falls back to showing the raw pattern (see label() below), so adding a
// new route without updating this dictionary degrades gracefully instead of breaking the page.
const PAGE_LABELS: Record<string, string> = {
  '': 'adminStats.pageHome',
  login: 'adminStats.pageLogin',
  register: 'adminStats.pageRegister',
  'forgot-password': 'adminStats.pageForgotPassword',
  'reset-password': 'adminStats.pageResetPassword',
  'verify-email': 'adminStats.pageVerifyEmail',
  privacy: 'adminStats.pagePrivacy',
  terms: 'adminStats.pageTerms',
  listings: 'adminStats.pageListings',
  'listings/new': 'adminStats.pageListingNew',
  'listings/:id/edit': 'adminStats.pageListingEdit',
  'listings/:id/viabilidad-comercial': 'adminStats.pageViability',
  'listings/:id': 'adminStats.pageListingDetail',
  map: 'adminStats.pageMap',
  agents: 'adminStats.pageAgents',
  'agents/new': 'adminStats.pageAgentNew',
  'agents/edit': 'adminStats.pageAgentEdit',
  'agents/:id': 'adminStats.pageAgentDetail',
  owners: 'adminStats.pageOwners',
  'owners/new': 'adminStats.pageOwnerNew',
  'owners/edit': 'adminStats.pageOwnerEdit',
  'owners/:id': 'adminStats.pageOwnerDetail',
  inmobiliarias: 'adminStats.pageAgencies',
  'inmobiliarias/new': 'adminStats.pageAgencyNew',
  'inmobiliarias/edit': 'adminStats.pageAgencyEdit',
  'inmobiliarias/:id': 'adminStats.pageAgencyDetail',
  favorites: 'adminStats.pageFavorites',
  comparar: 'adminStats.pageCompare',
  messages: 'adminStats.pageMessages',
  'saved-searches': 'adminStats.pageSavedSearches',
  fraccionamientos: 'adminStats.pageFraccionamientos',
  'fraccionamientos/:id': 'adminStats.pageFraccionamientoDetail',
  pipeline: 'adminStats.pagePipeline',
  'admin/errors': 'adminStats.pageAdminErrors',
  'admin/fraccionamientos': 'adminStats.pageAdminFraccionamientos',
  'admin/inmobiliarias': 'adminStats.pageAdminAgencies',
  'admin/estadisticas': 'adminStats.pageAdminStats'
};

export const WEEKS_OPTIONS = [4, 8, 12, 26] as const;

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-stats.component.html',
  styleUrl: './admin-stats.component.css'
})
export class AdminStatsComponent implements OnInit {
  readonly weeks = signal<WeeklyPageViews[]>([]);
  readonly loading = signal(false);
  readonly weeksBack = signal<number>(WEEKS_OPTIONS[1]);
  readonly weeksOptions = WEEKS_OPTIONS;

  // Same stale-response guard as AdminErrorsComponent.load — a weeksBack change fires a new
  // request before a slower, earlier one resolves.
  private loadSequence = 0;

  constructor(
    private readonly pageViewService: PageViewService,
    private readonly notification: NotificationService,
    seo: SeoService
  ) {
    seo.set({ title: 'Estadísticas (admin)', description: 'Páginas más vistas del sitio.', path: '/admin/estadisticas' });
  }

  ngOnInit(): void {
    this.load();
  }

  setWeeksBack(weeks: number): void {
    if (weeks === this.weeksBack()) return;
    this.weeksBack.set(weeks);
    this.load();
  }

  pageLabelKey(pathPattern: string): string {
    return PAGE_LABELS[pathPattern] ?? '';
  }

  private load(): void {
    this.loading.set(true);
    const sequence = ++this.loadSequence;

    this.pageViewService
      .getStats(this.weeksBack())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          if (sequence !== this.loadSequence) return;
          this.weeks.set(result);
        },
        error: () => {
          if (sequence !== this.loadSequence) return;
          this.notification.error('adminStats.loadError');
        }
      });
  }
}
