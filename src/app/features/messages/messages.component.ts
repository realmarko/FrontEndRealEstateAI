import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { InquiryService } from '../../core/services/inquiry.service';
import { NotificationService } from '../../core/services/notification.service';
import { FundingMethod, Inquiry, PurchaseTimeline } from '../../core/models/inquiry.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';

// Exact i18n key per value — a string-transform (e.g. camelCase -> "funding" + Titlecase)
// would silently miss keys like fundingInfonavitFovissste or timelineOneToThreeMonths.
const FUNDING_METHOD_KEYS: Record<FundingMethod, string> = {
  cash: 'contactModal.fundingCash',
  bankLoan: 'contactModal.fundingBankLoan',
  infonavitFovissste: 'contactModal.fundingInfonavitFovissste',
  notSure: 'contactModal.fundingNotSure'
};

const TIMELINE_KEYS: Record<PurchaseTimeline, string> = {
  readyNow: 'contactModal.timelineReadyNow',
  oneToThreeMonths: 'contactModal.timelineOneToThreeMonths',
  threeToSixMonths: 'contactModal.timelineThreeToSixMonths',
  justBrowsing: 'contactModal.timelineJustBrowsing'
};

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [RouterLink, TranslatePipe, DatePipe, SkeletonLoaderComponent, StatePanelComponent],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent implements OnInit {
  private readonly markingReadIds = signal<ReadonlySet<string>>(new Set());

  readonly unreadCount = computed(() => this.inquiryService.received().filter((i) => !i.isRead).length);

  constructor(
    readonly inquiryService: InquiryService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.inquiryService.refresh();
  }

  retry(): void {
    this.inquiryService.refresh();
  }

  isMarkingRead(inquiry: Inquiry): boolean {
    return this.markingReadIds().has(inquiry.id);
  }

  markRead(inquiry: Inquiry): void {
    if (inquiry.isRead || this.isMarkingRead(inquiry)) return;

    this.markingReadIds.update((ids) => new Set(ids).add(inquiry.id));
    this.inquiryService
      .markRead(inquiry.id)
      .pipe(
        // Runs on both success and error, unlike subscribe's complete callback (which RxJS
        // never calls after an error) — without this, a failed request would leave the id
        // stuck in markingReadIds forever, permanently blocking retries via the guard above.
        finalize(() =>
          this.markingReadIds.update((ids) => {
            const next = new Set(ids);
            next.delete(inquiry.id);
            return next;
          })
        )
      )
      .subscribe({ error: () => this.notification.error('messages.markReadError') });
  }

  fundingMethodKey(method: FundingMethod): string {
    return FUNDING_METHOD_KEYS[method];
  }

  timelineKey(timeline: PurchaseTimeline): string {
    return TIMELINE_KEYS[timeline];
  }
}
