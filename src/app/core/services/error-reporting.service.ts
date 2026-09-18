import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ErrorReportingService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/errors`;

  // Best-effort: called from GlobalErrorHandler, which already means something just went wrong —
  // a failure reporting THAT failure must never throw again or the user sees a second, unrelated
  // error on top of the real one. Anonymous-friendly on the backend, so this works whether or not
  // anyone is signed in.
  report(message: string, stack?: string): void {
    this.http.post(this.apiUrl, { section: this.router.url, message, stack }).subscribe({ error: () => {} });
  }
}
