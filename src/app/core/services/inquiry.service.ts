import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Inquiry, InquiryInput } from '../models/inquiry.model';
import { InquiryDto, fromDto, toCreateBody } from './inquiry-api.adapter';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/inquiries`;

  private readonly receivedSignal = signal<Inquiry[]>([]);
  readonly received = this.receivedSignal.asReadonly();

  create(input: InquiryInput): Observable<void> {
    return this.http.post<void>(this.apiUrl, toCreateBody(input));
  }

  refresh(): void {
    this.http
      .get<InquiryDto[]>(`${this.apiUrl}/received`)
      .subscribe((dtos) => this.receivedSignal.set(dtos.map(fromDto)));
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => this.receivedSignal.update((list) => list.map((i) => (i.id === id ? { ...i, isRead: true } : i))))
    );
  }
}
