import { Component, Input, OnChanges, Output, EventEmitter, signal } from '@angular/core';
import * as QRCode from 'qrcode';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NotificationService } from '../../../core/services/notification.service';

// Generic "scan this" popup: given any public URL, renders it as a downloadable QR code
// (client-side, via the qrcode package — no third-party QR-image service ever sees the URL).
// Reused by the listing fact-sheet QR today; the agent/brokerage "show their properties" QR
// ideas can reuse this same component with a different url/fileName.
@Component({
  selector: 'app-qr-code-modal',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './qr-code-modal.component.html',
  styleUrl: './qr-code-modal.component.css'
})
export class QrCodeModalComponent implements OnChanges {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) hint!: string;
  @Input({ required: true }) url!: string;
  @Input() fileName = 'qr-code.png';

  @Output() closed = new EventEmitter<void>();

  constructor(private readonly notification: NotificationService) {}

  readonly qrDataUrl = signal<string | null>(null);
  // Distinct from qrDataUrl === null while a generation is still in flight — without this, a
  // real failure (e.g. a malformed url) would leave the template stuck showing "Generating..."
  // forever instead of telling the viewer it didn't work.
  readonly generationFailed = signal(false);

  ngOnChanges(): void {
    if (!this.url) return;
    this.qrDataUrl.set(null);
    this.generationFailed.set(false);
    QRCode.toDataURL(this.url, { width: 320, margin: 1 })
      .then((dataUrl) => this.qrDataUrl.set(dataUrl))
      .catch(() => this.generationFailed.set(true));
  }

  downloadQr(): void {
    const dataUrl = this.qrDataUrl();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = this.fileName;
    link.click();
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
      this.notification.success('qrCodeModal.linkCopied');
    } catch {
      this.notification.error('qrCodeModal.copyError');
    }
  }

  close(): void {
    this.closed.emit();
  }
}
