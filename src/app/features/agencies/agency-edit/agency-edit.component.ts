import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

// Mirrors PhotoUploadService's server-side limits exactly — see AgentSignupComponent's identical
// client-side check for the agent photo picker.
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-agency-edit',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './agency-edit.component.html',
  styleUrl: './agency-edit.component.css'
})
export class AgencyEditComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brokerageService = inject(BrokerageService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  private agencyId: number | null = null;
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly logoPreview = signal<string | null>(null);
  readonly logoError = signal<string | null>(null);
  private selectedLogo: File | null = null;

  readonly form = this.fb.nonNullable.group({
    state: [''],
    city: [''],
    website: [''],
    facebookUrl: [''],
    instagramUrl: [''],
    description: ['']
  });

  constructor() {
    // No id route param on purpose: /brokerages/mine resolves it from the caller's own agent
    // profile, so an agent without a brokerage (or whose own profile doesn't exist yet) gets a
    // clean 404 here instead of needing to already know an id to visit this page.
    this.brokerageService.fetchMine().subscribe({
      next: (agency) => {
        this.agencyId = agency.id;
        this.form.patchValue({
          state: agency.state ?? '',
          city: agency.city ?? '',
          website: agency.website ?? '',
          facebookUrl: agency.facebookUrl ?? '',
          instagramUrl: agency.instagramUrl ?? '',
          description: agency.description ?? ''
        });
        this.logoPreview.set(agency.logoUrl ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      this.logoError.set(this.translation.t('agencyEdit.logoInvalidType'));
      input.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError.set(this.translation.t('agencyEdit.logoTooLarge'));
      input.value = '';
      return;
    }

    this.logoError.set(null);
    this.selectedLogo = file;

    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.submitting() || this.agencyId === null) return;

    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.brokerageService
      .updateMine(this.agencyId, {
        state: v.state.trim() || undefined,
        city: v.city.trim() || undefined,
        website: v.website.trim() || undefined,
        facebookUrl: v.facebookUrl.trim() || undefined,
        instagramUrl: v.instagramUrl.trim() || undefined,
        description: v.description.trim() || undefined,
        logo: this.selectedLogo ?? undefined
      })
      .subscribe({
        next: (agency) => {
          this.submitting.set(false);
          this.notification.success('agencyEdit.success');
          this.router.navigate(['/inmobiliarias', agency.id]);
        },
        error: () => {
          this.submitting.set(false);
          this.notification.error('agencyEdit.error');
        }
      });
  }
}
