import { Injectable, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
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
}
