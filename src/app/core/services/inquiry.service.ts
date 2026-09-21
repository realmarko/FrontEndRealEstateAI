import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Inquiry, InquiryInput } from '../models/inquiry.model';
import { InquiryDto, fromDto, toCreateBody } from './inquiry-api.adapter';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/inquiries`;

  private readonly receivedSignal = signal<Inquiry[]>([]);
  readonly received = this.receivedSignal.asReadonly();

  // Exposed so /messages can render its own loading/error states instead of the previous
  // silent-forever behavior on a failed fetch (refresh() had no error handling at all — an
  // uncaught HTTP error thrown from a bare .subscribe() with no error callback, the exact root
  // cause behind an earlier "[object Object]" report in the admin error log).
  readonly loading = signal(false);
  readonly loadError = signal(false);
  // Bumped on every refresh() call and captured per-request — retry() can be clicked again (or
  // a second refresh() triggered) before an earlier call's response arrives; without this, that
  // stale response's next/error handler could overwrite state set by a newer, already-resolved
  // call.
  private refreshSequence = 0;

  create(input: InquiryInput): Observable<void> {
    return this.http.post<void>(this.apiUrl, toCreateBody(input));
  }

  refresh(): void {
    const sequence = ++this.refreshSequence;
    this.loading.set(true);
    this.loadError.set(false);
    this.http
      .get<InquiryDto[]>(`${this.apiUrl}/received`)
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: (dtos) => {
          if (sequence === this.refreshSequence) this.receivedSignal.set(dtos.map(fromDto));
        },
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
      });
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => this.receivedSignal.update((list) => list.map((i) => (i.id === id ? { ...i, isRead: true } : i))))
    );
  }
}
