import { Injectable, inject } from '@angular/core';
import { ActiveToast, ToastrService } from 'ngx-toastr';
import { TranslationService } from './translation.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastr = inject(ToastrService);
  private readonly translation = inject(TranslationService);

  success(key: string, params?: Record<string, string | number>): void {
    this.toastr.success(this.translation.t(key, params));
  }

  error(key: string, params?: Record<string, string | number>): void {
    this.toastr.error(this.translation.t(key, params));
  }

  // For a background fetch that has no loading UI in view without scrolling (e.g. the viability
  // analysis, loaded below the fold) — same overlay-on-top mechanism as success/error above, so
  // it's visible immediately regardless of scroll position. disableTimeOut: true deliberately —
  // this toast must stay up only as long as the caller's request is actually in flight, so the
  // caller MUST pair this with dismiss() in both the success and error branches (never let it
  // time out on its own, and never leave it up indefinitely on failure).
  loading(key: string): ActiveToast<unknown> {
    return this.toastr.info(this.translation.t(key), undefined, {
      disableTimeOut: true,
      tapToDismiss: false,
      closeButton: false
    });
  }

  dismiss(toast: ActiveToast<unknown>): void {
    this.toastr.remove(toast.toastId);
  }
}
