import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ErrorLogService } from '../../../core/services/error-log.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorLogGroup } from '../../../core/models/error-log.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

type StatusFilter = 'unresolved' | 'resolved' | 'all';

// A group is identified by its signature, not a single id — resolving or expanding one acts on
// every occurrence sharing it (see ErrorLogService.resolveGroup and ErrorsController.ResolveGroup).
// JSON-encoded rather than naively joined with a separator: section/message are free-text and can
// contain any character (including a literal separator), so a plain join risks two different
// signatures producing the same key — JSON.stringify keeps each field's own quoting/escaping, so
// only an actually-identical array of the four fields produces the same string.
function groupKey(group: ErrorLogGroup): string {
  return JSON.stringify([group.source, group.severity, group.section, group.message]);
}

export const PAGE_SIZE_OPTIONS = [5, 10, 15] as const;

@Component({
  selector: 'app-admin-errors',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-errors.component.html',
  styleUrl: './admin-errors.component.css'
})
export class AdminErrorsComponent implements OnInit {
  readonly errors = signal<ErrorLogGroup[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly statusFilter = signal<StatusFilter>('unresolved');
  readonly page = signal(1);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[1]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly expandedKey = signal<string | null>(null);
  readonly expandedStackTrace = signal<string | null>(null);
  readonly loadingStackTrace = signal(false);

  private readonly resolvingKeys = signal<ReadonlySet<string>>(new Set());
  private readonly stackTraceCache = new Map<string, string | null>();
  // Bumped on every load() call and captured per-request — filter/page-size/page can each fire
  // their own load() in quick succession, and without this an older, slower response arriving
  // after a newer one would overwrite errors()/totalCount() with stale data that no longer
  // matches the currently-selected filter/pageSize/page.
  private loadSequence = 0;

  constructor(
    private readonly errorLogService: ErrorLogService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  readonly groupKey = groupKey;

  setFilter(filter: StatusFilter): void {
    if (filter === this.statusFilter()) return;
    this.statusFilter.set(filter);
    this.page.set(1);
    this.load();
  }

  setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.pageSize()));
  }

  toggleExpanded(group: ErrorLogGroup): void {
    const key = groupKey(group);
    if (this.expandedKey() === key) {
      this.expandedKey.set(null);
      return;
    }

    this.expandedKey.set(key);

    const cached = this.stackTraceCache.get(group.sampleId);
    if (cached !== undefined) {
      this.expandedStackTrace.set(cached);
      return;
    }

    this.expandedStackTrace.set(null);
    this.loadingStackTrace.set(true);
    this.errorLogService
      .getDetail(group.sampleId)
      .pipe(finalize(() => this.loadingStackTrace.set(false)))
      .subscribe({
        next: (detail) => {
          this.stackTraceCache.set(group.sampleId, detail.stackTrace);
          // The viewer may have collapsed (or expanded a different row) while this was in
          // flight — only apply it if they're still looking at the row it's for.
          if (this.expandedKey() === key) this.expandedStackTrace.set(detail.stackTrace);
        },
        error: () => this.notification.error('adminErrors.loadError')
      });
  }

  isResolving(group: ErrorLogGroup): boolean {
    return this.resolvingKeys().has(groupKey(group));
  }

  resolve(group: ErrorLogGroup): void {
    const key = groupKey(group);
    if (this.isResolving(group)) return;

    this.resolvingKeys.update((keys) => new Set(keys).add(key));
    this.errorLogService
      .resolveGroup({ source: group.source, severity: group.severity, section: group.section, message: group.message })
      .pipe(
        finalize(() =>
          this.resolvingKeys.update((keys) => {
            const next = new Set(keys);
            next.delete(key);
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
    const pageSize = this.pageSize();
    const sequence = ++this.loadSequence;

    this.errorLogService
      .list({ resolved, page: this.page(), pageSize })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          // A newer load() (from a filter/page-size/page change fired after this request went
          // out) has already started — its own response, not this stale one, should win.
          if (sequence !== this.loadSequence) return;

          // The page we asked for can be past the end now (e.g. resolving the last item on the
          // last page) — step back one and reload once rather than showing an empty page while
          // earlier pages still have real results.
          const maxPage = Math.max(1, Math.ceil(result.totalCount / pageSize));
          if (result.items.length === 0 && this.page() > maxPage) {
            this.page.set(maxPage);
            this.load();
            return;
          }

          this.errors.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        error: () => {
          if (sequence !== this.loadSequence) return;
          this.notification.error('adminErrors.loadError');
        }
      });
  }
}
