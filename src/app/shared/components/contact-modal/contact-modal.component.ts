import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
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
  imports: [TranslatePipe],
  templateUrl: './contact-modal.component.html',
  styleUrl: './contact-modal.component.css'
})
export class ContactModalComponent implements OnInit {
  @Input({ required: true }) title!: string;
  @Input() initialName = '';
  @Input() initialEmail = '';
  @Input() sending = false;
  @Input() showQualifyingQuestions = false;

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<ContactFormValue>();

  readonly name = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly message = signal('');
  readonly fundingMethod = signal<FundingMethod | ''>('');
  readonly timeline = signal<PurchaseTimeline | ''>('');
  readonly hasAgent = signal<'yes' | 'no' | ''>('');

  ngOnInit(): void {
    this.name.set(this.initialName);
    this.email.set(this.initialEmail);
  }

  close(): void {
    if (this.sending) return;
    this.closed.emit();
  }

  submit(): void {
    const hasAgent = this.hasAgent();

    this.sent.emit({
      name: this.name().trim(),
      phone: this.phone().trim(),
      email: this.email().trim(),
      message: this.message().trim(),
      fundingMethod: this.fundingMethod() || undefined,
      timeline: this.timeline() || undefined,
      hasAgent: hasAgent ? hasAgent === 'yes' : undefined
    });
  }
}
