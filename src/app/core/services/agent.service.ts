import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Agent, AgentProfileInput } from '../models/agent.model';
import { PagedResult } from '../models/paged-result.model';
import { AgentDto, fromDto } from './agent-api.adapter';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/agents`;

  private readonly agentsSignal = signal<Agent[]>([]);
  readonly agents = this.agentsSignal.asReadonly();

  constructor() {
    this.refresh();
  }

  refresh(name?: string): void {
    const params: Record<string, string | number> = { pageSize: 100 };
    if (name) params['name'] = name;

    this.http
      .get<PagedResult<AgentDto>>(this.apiUrl, { params })
      .subscribe((res) => this.agentsSignal.set(res.items.map(fromDto)));
  }

  createMine(input: AgentProfileInput): Observable<Agent> {
    return this.http.post<AgentDto>(this.apiUrl, input).pipe(
      map(fromDto),
      tap((agent) => this.agentsSignal.update((list) => [...list, agent]))
    );
  }
}
