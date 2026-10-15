import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AgencyImportResult } from '../../../core/models/agency.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

const MAX_CSV_BYTES = 2 * 1024 * 1024;

// Admin-only: bulk-creates Brokerage rows (BrokeragesController.Import) from a CSV with header
// nombre,lat,lng,direccion,telefono,email,horario — the scripted/bulk counterpart to one-at-a-time
// pinning from the map (AgencyCreateComponent). Each row is validated independently server-side,
// so the result can be a partial success (some rows created, some reported back by line number).
@Component({
  selector: 'app-admin-agencies',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './admin-agencies.component.html',
  styleUrl: './admin-agencies.component.css'
})
export class AdminAgenciesComponent {
  private readonly brokerageService = inject(BrokerageService);
  private readonly notification = inject(NotificationService);

  constructor() {
    inject(SeoService).set({ title: 'Inmobiliarias (admin)', description: 'Importación masiva de inmobiliarias.', path: '/admin/inmobiliarias' });
  }

  readonly fileName = signal<string | null>(null);
  // Holds an i18n key (e.g. 'adminAgencies.invalidType'), translated in the template — not
  // display text directly, same convention as NotificationService's toast keys.
  readonly fileError = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly result = signal<AgencyImportResult | null>(null);
  private selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.fileError.set('adminAgencies.invalidType');
      input.value = '';
      this.selectedFile = null;
      this.fileName.set(null);
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      this.fileError.set('adminAgencies.tooLarge');
      input.value = '';
      this.selectedFile = null;
      this.fileName.set(null);
      return;
    }

    this.fileError.set(null);
    this.selectedFile = file;
    this.fileName.set(file.name);
    this.result.set(null);
  }

  submit(): void {
    if (this.uploading() || !this.selectedFile) return;

    this.uploading.set(true);
    this.result.set(null);
    this.brokerageService
      .importCsv(this.selectedFile)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.notification.success('adminAgencies.uploadDone');
        },
        error: () => this.notification.error('adminAgencies.uploadError')
      });
  }
}
