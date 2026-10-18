import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FormErrorComponent } from '../form-error/form-error.component';
import { PhoneInputDirective } from '../../directives/phone-input.directive';

export interface ViabilityReportRequestValue {
  name: string;
  email: string;
  phone?: string;
}

// The gated half of the "Reporte de Viabilidad Comercial" lead magnet (see listing-detail's
// viability section) — just enough fields to send the full PDF report by email, no qualifying
// questions like ContactModalComponent's listing-inquiry flow (this isn't a buyer inquiry, it's a
// visitor claiming a free report). Phone is optional: unlike ContactModalComponent's default,
// nothing here promises a callback.
@Component({
  selector: 'app-viability-report-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormErrorComponent, PhoneInputDirective],
  templateUrl: './viability-report-modal.component.html',
  styleUrl: './viability-report-modal.component.css'
})
export class ViabilityReportModalComponent {
  @Input() sending = false;
  @Input() sent = false;
  // Object URL for the just-generated PDF (see listing-detail's viabilityReportUrl) — only
  // meaningful once `sent` is true; null while a request is in flight or hasn't happened yet.
  @Input() downloadUrl: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() requested = new EventEmitter<ViabilityReportRequestValue>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    phone: ['', [Validators.minLength(10), Validators.maxLength(10)]]
  });

  close(): void {
    if (this.sending) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone } = this.form.getRawValue();
    this.requested.emit({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined });
  }
}
