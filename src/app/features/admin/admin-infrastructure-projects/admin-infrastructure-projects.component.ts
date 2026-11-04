import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { InfrastructureProjectService } from '../../../core/services/infrastructure-project.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  InfrastructureProjectListItem,
  InfrastructureProjectStatus,
  InfrastructureProjectType,
  InfrastructureProjectUpsertInput
} from '../../../core/models/infrastructure-project.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

export const PAGE_SIZE_OPTIONS = [5, 10, 15] as const;

export const INFRASTRUCTURE_PROJECT_TYPES: InfrastructureProjectType[] = [
  'highwayExpansion',
  'newRoad',
  'industrialPark',
  'publicTransit',
  'hospital',
  'school',
  'other'
];
// 'cancelled' is deliberately excluded — the backend rejects PUT requests that try to set or
// un-set it, since that's a one-way transition only reachable through the dedicated "cancel"
// action below (see InfrastructureProjectsController.Update's own guard).
export const INFRASTRUCTURE_PROJECT_STATUSES: InfrastructureProjectStatus[] = ['announced', 'inProgress', 'completed'];

// Shared by both "add manually" and "edit" forms — every row is admin-entered from the start (no
// separate raw-candidate stage like Fraccionamiento), so one form shape covers both, same as the
// backend's single InfrastructureProjectUpsertDto. Coordinates stay a single pasteable text field
// (same reasoning/parser as admin-fraccionamientos' own "19.04, -98.20" field) rather than two
// separate numeric inputs.
interface FormValue {
  name: string;
  description: string;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  coordinates: string;
  affectedRadiusMeters: string;
  announcedDate: string;
  expectedCompletionDate: string;
  sourceUrl: string;
}

function emptyForm(): FormValue {
  return {
    name: '',
    description: '',
    type: 'highwayExpansion',
    status: 'announced',
    coordinates: '',
    affectedRadiusMeters: '2000',
    announcedDate: new Date().toISOString().slice(0, 10),
    expectedCompletionDate: '',
    sourceUrl: ''
  };
}

function detailToForm(detail: {
  name: string;
  description: string | null;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  latitude: number;
  longitude: number;
  affectedRadiusMeters: number;
  announcedDate: string;
  expectedCompletionDate: string | null;
  sourceUrl: string | null;
}): FormValue {
  return {
    name: detail.name,
    description: detail.description ?? '',
    type: detail.type,
    status: detail.status,
    coordinates: `${detail.latitude}, ${detail.longitude}`,
    affectedRadiusMeters: String(detail.affectedRadiusMeters),
    announcedDate: detail.announcedDate.slice(0, 10),
    expectedCompletionDate: detail.expectedCompletionDate ? detail.expectedCompletionDate.slice(0, 10) : '',
    sourceUrl: detail.sourceUrl ?? ''
  };
}

// "19.04, -98.20" (comma/whitespace-separated) → { latitude, longitude }, or null — same parser
// as admin-fraccionamientos.component.ts's own local copy (not the shared
// shared/utils/parse-coordinates.ts, which returns google.maps.LatLngLiteral and assumes the
// Maps script is loaded; this admin page never touches a map).
function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const parts = text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function formToInput(form: FormValue, coordinates: { latitude: number; longitude: number }): InfrastructureProjectUpsertInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    type: form.type,
    status: form.status,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    affectedRadiusMeters: Number(form.affectedRadiusMeters) || 2000,
    announcedDate: form.announcedDate,
    expectedCompletionDate: form.expectedCompletionDate || null,
    sourceUrl: form.sourceUrl.trim() || null
  };
}

@Component({
  selector: 'app-admin-infrastructure-projects',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-infrastructure-projects.component.html',
  styleUrl: './admin-infrastructure-projects.component.css'
})
export class AdminInfrastructureProjectsComponent implements OnInit {
  readonly types = INFRASTRUCTURE_PROJECT_TYPES;
  readonly statuses = INFRASTRUCTURE_PROJECT_STATUSES;

  readonly items = signal<InfrastructureProjectListItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[1]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly expandedId = signal<string | null>(null);
  readonly editForm = signal<FormValue>(emptyForm());
  readonly saving = signal(false);
  readonly cancelling = signal(false);

  readonly showAddForm = signal(false);
  readonly addForm = signal<FormValue>(emptyForm());
  readonly creating = signal(false);

  // Same guard as admin-fraccionamientos' loadSequence — a slower response from a page change
  // fired earlier can't overwrite items()/totalCount() with now-stale data.
  private loadSequence = 0;

  constructor(
    private readonly infrastructureProjectService: InfrastructureProjectService,
    private readonly notification: NotificationService,
    seo: SeoService
  ) {
    seo.set({
      title: 'Proyectos de infraestructura (admin)',
      description: 'Administración de proyectos de infraestructura anunciados.',
      path: '/admin/infrastructure-projects'
    });
  }

  ngOnInit(): void {
    this.load();
  }

  // The service's status/type values are camelCase ('inProgress'), but the i18n keys follow this
  // app's PascalCase-suffix convention ('adminInfrastructureProjects.statusInProgress', same as
  // adminFraccionamientos.status+Candidate) — this capitalizes the first letter so the template
  // can build the key by concatenation without a mismatch.
  translationKey(prefix: string, value: string): string {
    return `adminInfrastructureProjects.${prefix}${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.pageSize()));
  }

  toggleExpanded(item: InfrastructureProjectListItem): void {
    if (this.expandedId() === item.id) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(item.id);
    this.infrastructureProjectService.getDetail(item.id).subscribe({
      next: (detail) => {
        if (this.expandedId() !== item.id) return;
        this.editForm.set(detailToForm(detail));
      },
      error: () => this.notification.error('adminInfrastructureProjects.loadError')
    });
  }

  updateEditForm<K extends keyof FormValue>(field: K, value: FormValue[K]): void {
    this.editForm.update((current) => ({ ...current, [field]: value }));
  }

  save(id: string): void {
    if (this.saving()) return;

    const form = this.editForm();
    const coordinates = parseCoordinates(form.coordinates);
    if (!form.name.trim() || !coordinates) {
      this.notification.error('adminInfrastructureProjects.formInvalid');
      return;
    }

    this.saving.set(true);
    this.infrastructureProjectService
      .update(id, formToInput(form, coordinates))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.expandedId.set(null);
          this.load();
        },
        error: () => this.notification.error('adminInfrastructureProjects.saveError')
      });
  }

  cancelProject(id: string): void {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.infrastructureProjectService
      .cancel(id)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: () => {
          this.expandedId.set(null);
          this.load();
        },
        error: () => this.notification.error('adminInfrastructureProjects.cancelError')
      });
  }

  toggleAddForm(): void {
    this.showAddForm.update((v) => !v);
    if (this.showAddForm()) this.addForm.set(emptyForm());
  }

  updateAddForm<K extends keyof FormValue>(field: K, value: FormValue[K]): void {
    this.addForm.update((current) => ({ ...current, [field]: value }));
  }

  submitAdd(): void {
    if (this.creating()) return;

    const form = this.addForm();
    const coordinates = parseCoordinates(form.coordinates);
    if (!form.name.trim() || !coordinates) {
      this.notification.error('adminInfrastructureProjects.formInvalid');
      return;
    }

    this.creating.set(true);
    this.infrastructureProjectService
      .create(formToInput(form, coordinates))
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: () => {
          this.showAddForm.set(false);
          this.notification.success('adminInfrastructureProjects.addSuccess');
          this.page.set(1);
          this.load();
        },
        error: () => this.notification.error('adminInfrastructureProjects.addError')
      });
  }

  private load(): void {
    this.loading.set(true);
    const pageSize = this.pageSize();
    const sequence = ++this.loadSequence;

    this.infrastructureProjectService
      .list({ page: this.page(), pageSize })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          if (sequence !== this.loadSequence) return;

          const maxPage = Math.max(1, Math.ceil(result.totalCount / pageSize));
          if (result.items.length === 0 && this.page() > maxPage) {
            this.page.set(maxPage);
            this.load();
            return;
          }

          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        error: () => {
          if (sequence !== this.loadSequence) return;
          this.notification.error('adminInfrastructureProjects.loadError');
        }
      });
  }
}
