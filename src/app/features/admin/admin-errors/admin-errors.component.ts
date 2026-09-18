import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ErrorLogService } from '../../../core/services/error-log.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorLog } from '../../../core/models/error-log.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

type StatusFilter = 'unresolved' | 'resolved' | 'all';

@Component({
  selector: 'app-admin-errors',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-errors.component.html',
  styleUrl: './admin-errors.component.css'
})
export class AdminErrorsComponent implements OnInit {
  readonly errors = signal<ErrorLog[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly statusFilter = signal<StatusFilter>('unresolved');
  readonly page = signal(1);
  readonly expandedId = signal<string | null>(null);
  readonly expandedStackTrace = signal<string | null>(null);
  readonly loadingStackTrace = signal(false);

  private readonly resolvingIds = signal<ReadonlySet<string>>(new Set());
  private readonly stackTraceCache = new Map<string, string | null>();
  private readonly pageSize = 20;

  constructor(
    private readonly errorLogService: ErrorLogService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setFilter(filter: StatusFilter): void {
    if (filter === this.statusFilter()) return;
    this.statusFilter.set(filter);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.pageSize));
  }

  toggleExpanded(error: ErrorLog): void {
    if (this.expandedId() === error.id) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(error.id);

    const cached = this.stackTraceCache.get(error.id);
    if (cached !== undefined) {
      this.expandedStackTrace.set(cached);
      return;
    }

    this.expandedStackTrace.set(null);
    this.loadingStackTrace.set(true);
    this.errorLogService
      .getDetail(error.id)
      .pipe(finalize(() => this.loadingStackTrace.set(false)))
      .subscribe({
        next: (detail) => {
          this.stackTraceCache.set(error.id, detail.stackTrace);
          // The viewer may have collapsed (or expanded a different row) while this was in
          // flight — only apply it if they're still looking at the row it's for.
          if (this.expandedId() === error.id) this.expandedStackTrace.set(detail.stackTrace);
        },
        error: () => this.notification.error('adminErrors.loadError')
      });
  }

  isResolving(error: ErrorLog): boolean {
    return this.resolvingIds().has(error.id);
  }

  resolve(error: ErrorLog): void {
    if (this.isResolving(error)) return;

    this.resolvingIds.update((ids) => new Set(ids).add(error.id));
    this.errorLogService
      .resolve(error.id)
      .pipe(
        finalize(() =>
          this.resolvingIds.update((ids) => {
            const next = new Set(ids);
            next.delete(error.id);
            return next;
          })
        )
      )
      .subscribe({
        // A real refetch, not a hand-patched local list: this was previously done by splicing
        // the item out of `errors()` and decrementing `totalCount()` locally, which never
        // reconciled `page()` — resolving the one remaining unresolved item on page 2 emptied
        // the list in place and left the viewer stranded on a page that looked like "no errors
        // at all" while real unresolved errors still existed on page 1.
        next: () => this.load(),
        error: () => this.notification.error('adminErrors.resolveError')
      });
  }

  private load(): void {
    this.loading.set(true);
    const resolved = this.statusFilter() === 'all' ? undefined : this.statusFilter() === 'resolved';

    this.errorLogService
      .list({ resolved, page: this.page(), pageSize: this.pageSize })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          // The page we asked for can be past the end now (e.g. resolving the last item on the
          // last page) — step back one and reload once rather than showing an empty page while
          // earlier pages still have real results.
          const maxPage = Math.max(1, Math.ceil(result.totalCount / this.pageSize));
          if (result.items.length === 0 && this.page() > maxPage) {
            this.page.set(maxPage);
            this.load();
            return;
          }

          this.errors.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        error: () => this.notification.error('adminErrors.loadError')
      });
  }
}
