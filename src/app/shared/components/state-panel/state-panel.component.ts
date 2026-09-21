import { Component, EventEmitter, Input, Output } from '@angular/core';

// Shared error/empty-state panel — introduced after messages and favorites independently grew
// byte-for-byte identical .state-panel/.retry-btn CSS. The message itself is content-projected
// (each page's copy and any links inside it differ), and retryLabel is passed pre-translated so
// this component doesn't need its own i18n dependency.
@Component({
  selector: 'app-state-panel',
  standalone: true,
  templateUrl: './state-panel.component.html',
  styleUrl: './state-panel.component.css'
})
export class StatePanelComponent {
  @Input() kind: 'error' | 'empty' = 'error';
  @Input() retryLabel = '';
  @Output() retry = new EventEmitter<void>();
}
