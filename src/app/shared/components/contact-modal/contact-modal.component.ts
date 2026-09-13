import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface ContactFormValue {
  name: string;
  phone: string;
  email: string;
  message: string;
}

// Shared popup for "contact someone about X" flows (an agent, a listing owner, ...) — the
// caller owns when it's shown (wrap it in an @if) and what happens with the submitted
// values; this component only owns the form fields themselves.
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

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<ContactFormValue>();

  readonly name = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    this.name.set(this.initialName);
    this.email.set(this.initialEmail);
  }

  close(): void {
    if (this.sending) return;
    this.closed.emit();
  }

  submit(): void {
    this.sent.emit({
      name: this.name().trim(),
      phone: this.phone().trim(),
      email: this.email().trim(),
      message: this.message().trim()
    });
  }
}
