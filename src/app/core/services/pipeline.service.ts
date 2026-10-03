import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  PipelineMetrics,
  PipelineStage,
  SaleProcessCreateInput,
  SaleProcessDetail,
  SaleProcessSummary,
  SaleProcessTask
} from '../models/pipeline.model';

const EMPTY_METRICS: PipelineMetrics = { activeCount: 0, totalValue: 0, legalReviewCount: 0, closedCount: 0 };

@Injectable({ providedIn: 'root' })
export class PipelineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly stagesSignal = signal<PipelineStage[]>([]);
  private readonly processesSignal = signal<SaleProcessSummary[]>([]);
  private readonly metricsSignal = signal<PipelineMetrics>(EMPTY_METRICS);

  readonly stages = this.stagesSignal.asReadonly();
  readonly processes = this.processesSignal.asReadonly();
  readonly metrics = this.metricsSignal.asReadonly();

  readonly loading = signal(false);
  readonly loadError = signal(false);
  private refreshSequence = 0;

  // Stages, processes and metrics all load together under the same loading/error/sequence
  // guard — a separate fire-and-forget loadStages() previously left `stages()` silently stuck
  // at [] on its own failure (with processes()/loadError() showing nothing wrong), which made
  // the board render zero columns with no error state.
  refresh(): void {
    const sequence = ++this.refreshSequence;
    this.loading.set(true);
    this.loadError.set(false);

    forkJoin({
      stages: this.http.get<PipelineStage[]>(`${this.apiUrl}/pipeline-stages`),
      processes: this.http.get<SaleProcessSummary[]>(`${this.apiUrl}/sale-processes`),
      metrics: this.http.get<PipelineMetrics>(`${this.apiUrl}/sale-processes/metrics`)
    })
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: ({ stages, processes, metrics }) => {
          if (sequence !== this.refreshSequence) return;
          this.stagesSignal.set(stages);
          this.processesSignal.set(processes);
          this.metricsSignal.set(metrics);
        },
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
      });
  }

  getDetail(id: string): Observable<SaleProcessDetail> {
    return this.http.get<SaleProcessDetail>(`${this.apiUrl}/sale-processes/${id}`);
  }

  create(input: SaleProcessCreateInput): Observable<SaleProcessDetail> {
    return this.http
      .post<SaleProcessDetail>(`${this.apiUrl}/sale-processes`, input)
      .pipe(tap(() => this.refresh()));
  }

  updateStage(id: string, stageId: number): Observable<SaleProcessDetail> {
    return this.http
      .patch<SaleProcessDetail>(`${this.apiUrl}/sale-processes/${id}/stage`, { stageId })
      .pipe(tap(() => this.refresh()));
  }

  deleteProcess(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sale-processes/${id}`).pipe(tap(() => this.refresh()));
  }

  updateDocument(processId: string, documentId: string, isVerified: boolean): Observable<void> {
    return this.http
      .patch<void>(`${this.apiUrl}/sale-processes/${processId}/documents/${documentId}`, { isVerified })
      .pipe(tap(() => this.refresh()));
  }

  addTask(processId: string, title: string): Observable<SaleProcessTask> {
    return this.http
      .post<SaleProcessTask>(`${this.apiUrl}/sale-processes/${processId}/tasks`, { title })
      .pipe(tap(() => this.refresh()));
  }

  updateTask(processId: string, taskId: string, isCompleted: boolean): Observable<void> {
    return this.http
      .patch<void>(`${this.apiUrl}/sale-processes/${processId}/tasks/${taskId}`, { isCompleted })
      .pipe(tap(() => this.refresh()));
  }

  deleteTask(processId: string, taskId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/sale-processes/${processId}/tasks/${taskId}`)
      .pipe(tap(() => this.refresh()));
  }
}
