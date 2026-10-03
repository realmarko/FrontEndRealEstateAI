import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { PipelineService } from '../../../core/services/pipeline.service';
import { SaleProcessCreateInput, SaleProcessDetail, SaleProcessSummary } from '../../../core/models/pipeline.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { TranslationService } from '../../../core/services/translation.service';
import { DealDetailModalComponent } from '../deal-detail-modal/deal-detail-modal.component';
import { NewDealModalComponent } from '../new-deal-modal/new-deal-modal.component';

// Post-venta's stage id (seeded by the backend's AddSalePipeline migration) — excluded from
// "active" and counted as "closed", same convention as SaleProcessesController.FinalStageId.
const FINAL_STAGE_ID = 9;

@Component({
  selector: 'app-pipeline-board',
  standalone: true,
  imports: [TranslatePipe, CurrencyPipe, SkeletonLoaderComponent, StatePanelComponent, DealDetailModalComponent, NewDealModalComponent],
  templateUrl: './pipeline-board.component.html',
  styleUrl: './pipeline-board.component.css'
})
export class PipelineBoardComponent implements OnInit {
  protected readonly pipeline = inject(PipelineService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);

  readonly columns = computed(() =>
    this.pipeline.stages().map((stage) => ({
      stage,
      deals: this.pipeline.processes().filter((p) => p.currentStageId === stage.id)
    }))
  );

  readonly showNewDealModal = signal(false);
  readonly savingNewDeal = signal(false);

  readonly selectedDeal = signal<SaleProcessDetail | null>(null);
  private draggingId: string | null = null;
  readonly dragOverStageId = signal<number | null>(null);

  ngOnInit(): void {
    this.pipeline.refresh();
  }

  retry(): void {
    this.pipeline.refresh();
  }

  // -- Drag & drop (native HTML5 DnD, same approach as the approved prototype) --

  onDragStart(dealId: string): void {
    this.draggingId = dealId;
  }

  onDragOver(stageId: number, event: DragEvent): void {
    event.preventDefault();
    this.dragOverStageId.set(stageId);
  }

  onDragLeave(): void {
    this.dragOverStageId.set(null);
  }

  onDrop(stageId: number, event: DragEvent): void {
    event.preventDefault();
    this.dragOverStageId.set(null);
    const dealId = this.draggingId;
    this.draggingId = null;
    if (!dealId) return;

    const deal = this.pipeline.processes().find((p) => p.id === dealId);
    if (!deal || deal.currentStageId === stageId) return;

    this.pipeline.updateStage(dealId, stageId).subscribe({
      error: () => this.notification.error('pipeline.error')
    });
  }

  // -- Metrics summary line already comes from PipelineService.metrics(); FINAL_STAGE_ID is
  // only needed client-side for the card's own stage badge styling. --
  isFinalStage(deal: SaleProcessSummary): boolean {
    return deal.currentStageId === FINAL_STAGE_ID;
  }

  // -- Deal detail modal --

  openDeal(dealId: string): void {
    this.pipeline.getDetail(dealId).subscribe({
      next: (detail) => this.selectedDeal.set(detail),
      error: () => this.notification.error('pipeline.error')
    });
  }

  closeDeal(): void {
    this.selectedDeal.set(null);
  }

  changeStage(stageId: number): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    this.pipeline.updateStage(deal.id, stageId).subscribe({
      next: (detail) => this.selectedDeal.set(detail),
      error: () => this.notification.error('pipeline.error')
    });
  }

  // Document/task mutations apply the already-known change locally instead of re-fetching the
  // full detail — the service's own refresh() (via its internal tap) still keeps the board's
  // card counts and metrics in sync; this just avoids a second round trip for the open modal.
  toggleDocument(event: { documentId: string; isVerified: boolean }): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    this.pipeline.updateDocument(deal.id, event.documentId, event.isVerified).subscribe({
      next: () => this.updateSelectedDeal((d) => {
        const documents = d.documents.map((doc) =>
          doc.id === event.documentId
            ? { ...doc, isVerified: event.isVerified, verifiedAt: event.isVerified ? new Date().toISOString() : undefined }
            : doc
        );
        return { ...d, documents, documentsVerified: documents.filter((doc) => doc.isVerified).length };
      }),
      error: () => this.notification.error('pipeline.error')
    });
  }

  addTask(title: string): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    this.pipeline.addTask(deal.id, title).subscribe({
      next: (task) => this.updateSelectedDeal((d) => {
        const tasks = [...d.tasks, task];
        return { ...d, tasks, tasksTotal: tasks.length, tasksCompleted: tasks.filter((t) => t.isCompleted).length };
      }),
      error: () => this.notification.error('pipeline.error')
    });
  }

  toggleTask(event: { taskId: string; isCompleted: boolean }): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    this.pipeline.updateTask(deal.id, event.taskId, event.isCompleted).subscribe({
      next: () => this.updateSelectedDeal((d) => {
        const tasks = d.tasks.map((t) =>
          t.id === event.taskId
            ? { ...t, isCompleted: event.isCompleted, completedAt: event.isCompleted ? new Date().toISOString() : undefined }
            : t
        );
        return { ...d, tasks, tasksCompleted: tasks.filter((t) => t.isCompleted).length };
      }),
      error: () => this.notification.error('pipeline.error')
    });
  }

  deleteTask(taskId: string): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    this.pipeline.deleteTask(deal.id, taskId).subscribe({
      next: () => this.updateSelectedDeal((d) => {
        const tasks = d.tasks.filter((t) => t.id !== taskId);
        return { ...d, tasks, tasksTotal: tasks.length, tasksCompleted: tasks.filter((t) => t.isCompleted).length };
      }),
      error: () => this.notification.error('pipeline.error')
    });
  }

  deleteDeal(): void {
    const deal = this.selectedDeal();
    if (!deal) return;
    if (!confirm(this.translation.t('pipeline.detail.deleteConfirm'))) return;

    this.pipeline.deleteProcess(deal.id).subscribe({
      next: () => this.selectedDeal.set(null),
      error: () => this.notification.error('pipeline.error')
    });
  }

  private updateSelectedDeal(updater: (deal: SaleProcessDetail) => SaleProcessDetail): void {
    const deal = this.selectedDeal();
    if (deal) this.selectedDeal.set(updater(deal));
  }

  // -- New deal modal --

  openNewDeal(): void {
    this.showNewDealModal.set(true);
  }

  closeNewDeal(): void {
    this.showNewDealModal.set(false);
  }

  createDeal(input: SaleProcessCreateInput): void {
    this.savingNewDeal.set(true);
    this.pipeline.create(input).subscribe({
      next: () => {
        this.savingNewDeal.set(false);
        this.showNewDealModal.set(false);
      },
      error: () => {
        this.savingNewDeal.set(false);
        this.notification.error('pipeline.error');
      }
    });
  }
}
