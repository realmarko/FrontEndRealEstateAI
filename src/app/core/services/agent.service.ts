import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Agent } from '../models/agent.model';
import { AgentDto, fromDto } from './agent-api.adapter';

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/agents`;

  private readonly agentsSignal = signal<Agent[]>([]);
  readonly agents = this.agentsSignal.asReadonly();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.http
      .get<PagedResult<AgentDto>>(this.apiUrl, { params: { pageSize: 100 } })
      .subscribe((res) => this.agentsSignal.set(res.items.map(fromDto)));
  }
}
