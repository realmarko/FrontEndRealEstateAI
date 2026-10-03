import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PipelineStage, SaleProcessCreateInput } from '../../../core/models/pipeline.model';

// Mirrors ContactModalComponent's shape (signal-backed fields, closed/sent outputs, caller owns
// visibility via @if) rather than a ReactiveForms group — this form is short enough that the
// extra machinery wouldn't pay for itself.
@Component({
  selector: 'app-new-deal-modal',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './new-deal-modal.component.html',
  styleUrl: './new-deal-modal.component.css'
})
export class NewDealModalComponent {
  @Input({ required: true }) stages: PipelineStage[] = [];
  @Input() saving = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SaleProcessCreateInput>();

  readonly clientName = signal('');
  readonly clientPhone = signal('');
  readonly propertyAddress = signal('');
  readonly estimatedPrice = signal<number | null>(null);
  readonly stageId = signal<number | null>(null);

  close(): void {
    if (this.saving) return;
    this.closed.emit();
  }

  submit(): void {
    const clientName = this.clientName().trim();
    const clientPhone = this.clientPhone().trim();
    const propertyAddress = this.propertyAddress().trim();
    const estimatedPrice = this.estimatedPrice();
    if (!clientName || !clientPhone || !propertyAddress || estimatedPrice === null || estimatedPrice <= 0) return;

    this.saved.emit({
      clientName,
      clientPhone,
      propertyAddress,
      estimatedPrice,
      // Falls back to the first stage, matching what the <select> shows pre-selected when the
      // user never touches the dropdown (its [value] binding defaults the same way) — otherwise
      // the submitted stage could silently diverge from what was visually selected.
      stageId: this.stageId() ?? this.stages[0]?.id
    });
  }
}
