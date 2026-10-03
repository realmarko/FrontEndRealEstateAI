import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PipelineStage, SaleProcessDetail } from '../../../core/models/pipeline.model';

@Component({
  selector: 'app-deal-detail-modal',
  standalone: true,
  imports: [TranslatePipe, CurrencyPipe, DatePipe],
  templateUrl: './deal-detail-modal.component.html',
  styleUrl: './deal-detail-modal.component.css'
})
export class DealDetailModalComponent {
  private readonly dealSignal = signal<SaleProcessDetail | null>(null);

  // A setter, not a plain field: the stage <select> needs to reset to the deal's current stage
  // the first time a deal opens, but NOT on every later refresh of the same deal — a document
  // toggle or task edit also pushes a fresh SaleProcessDetail in here, and resetting then would
  // silently discard a stage the user had already picked but not yet confirmed with "Update".
  @Input({ required: true })
  set deal(value: SaleProcessDetail) {
    if (this.dealSignal()?.id !== value.id) this.pendingStageId.set(value.currentStageId);
    this.dealSignal.set(value);
  }
  get deal(): SaleProcessDetail {
    return this.dealSignal()!;
  }

  @Input({ required: true }) stages: PipelineStage[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() stageChanged = new EventEmitter<number>();
  @Output() documentToggled = new EventEmitter<{ documentId: string; isVerified: boolean }>();
  @Output() taskAdded = new EventEmitter<string>();
  @Output() taskToggled = new EventEmitter<{ taskId: string; isCompleted: boolean }>();
  @Output() taskDeleted = new EventEmitter<string>();
  @Output() deleted = new EventEmitter<void>();

  readonly pendingStageId = signal<number | null>(null);
  readonly newTaskTitle = signal('');

  readonly taskCompletedCount = computed(() => this.dealSignal()?.tasks.filter((t) => t.isCompleted).length ?? 0);

  close(): void {
    this.closed.emit();
  }

  updateStage(): void {
    const stageId = this.pendingStageId();
    if (stageId !== null && stageId !== this.deal.currentStageId) {
      this.stageChanged.emit(stageId);
    }
  }

  toggleDocument(documentId: string, isVerified: boolean): void {
    this.documentToggled.emit({ documentId, isVerified });
  }

  addTask(): void {
    const title = this.newTaskTitle().trim();
    if (!title) return;
    this.taskAdded.emit(title);
    this.newTaskTitle.set('');
  }

  toggleTask(taskId: string, isCompleted: boolean): void {
    this.taskToggled.emit({ taskId, isCompleted });
  }

  deleteTask(taskId: string): void {
    this.taskDeleted.emit(taskId);
  }

  deleteDeal(): void {
    this.deleted.emit();
  }
}
