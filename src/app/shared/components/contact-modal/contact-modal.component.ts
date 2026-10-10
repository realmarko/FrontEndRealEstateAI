import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FormErrorComponent } from '../form-error/form-error.component';
import { FundingMethod, PurchaseTimeline } from '../../../core/models/inquiry.model';

export interface ContactFormValue {
  name: string;
  phone: string;
  email: string;
  message: string;
  fundingMethod?: FundingMethod;
  timeline?: PurchaseTimeline;
  hasAgent?: boolean;
}

// Shared popup for "contact someone about X" flows (an agent, a listing owner, ...) — the
// caller owns when it's shown (wrap it in an @if) and what happens with the submitted
// values. Mostly domain-agnostic, with one exception: showQualifyingQuestions (default false)
// opts into three real-estate-specific buyer-qualification fields (funding/timeline/hasAgent)
// that only make sense for "contact about a specific listing" (listing-detail sets it true) —
// not for a general "contact this agent" profile inquiry (agent-detail leaves it false and
// never sees them). If a third caller ever needs its own different extra fields, that's the
// signal to stop growing this component with more boolean flags and split it instead.
@Component({
  selector: 'app-contact-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormErrorComponent],
  templateUrl: './contact-modal.component.html',
  styleUrl: './contact-modal.component.css'
})
export class ContactModalComponent implements OnInit {
  @Input({ required: true }) title!: string;
  @Input() initialName = '';
  @Input() initialEmail = '';
  @Input() sending = false;
  @Input() showQualifyingQuestions = false;
  // Defaults to true so every current caller keeps requiring a callback number (InquiryCreateDto.
  // SenderPhone is optional server-side, but a lead with no phone isn't useful to an agent) —
  // decoupled from showQualifyingQuestions so a future non-real-estate caller of this otherwise
  // domain-agnostic modal (e.g. a generic "contact support" flow) can opt out with
  // [phoneRequired]="false" instead of inheriting a lead-qualification rule it doesn't need.
  @Input() phoneRequired = true;

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<ContactFormValue>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    phone: ['', [Validators.minLength(7), Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    fundingMethod: ['' as FundingMethod | ''],
    timeline: ['' as PurchaseTimeline | ''],
    hasAgent: ['' as 'yes' | 'no' | '']
  });

  ngOnInit(): void {
    this.form.patchValue({ name: this.initialName, email: this.initialEmail });
    if (this.phoneRequired) {
      this.form.controls.phone.addValidators(Validators.required);
      this.form.controls.phone.updateValueAndValidity();
    }
  }

  close(): void {
    if (this.sending) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, phone, email, message, fundingMethod, timeline, hasAgent } = this.form.getRawValue();

    this.sent.emit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
      fundingMethod: fundingMethod || undefined,
      timeline: timeline || undefined,
      hasAgent: hasAgent ? hasAgent === 'yes' : undefined
    });
  }
}
