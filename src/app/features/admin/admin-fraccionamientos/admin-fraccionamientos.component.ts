import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { FraccionamientoService } from '../../../core/services/fraccionamiento.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ApproveFraccionamientoInput,
  CreateFraccionamientoInput,
  FraccionamientoDetail,
  FraccionamientoListItem
} from '../../../core/models/fraccionamiento.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

type StatusFilter = 'Candidate' | 'Published' | 'Rejected' | 'all';

export const PAGE_SIZE_OPTIONS = [5, 10, 15] as const;

// The "add manually" form — no n8n workflow for this source yet, so an admin can seed a
// candidate by hand. Latitude/Longitude are plain text here (not <input type="number">) so an
// admin can paste "19.04, -98.20" straight out of Google Maps and have it split on submit,
// rather than fighting two separate numeric fields.
interface AddFormValue {
  name: string;
  developerName: string;
  city: string;
  state: string;
  coordinates: string;
  stage: string;
}

function emptyAddForm(): AddFormValue {
  return { name: '', developerName: '', city: '', state: '', coordinates: '', stage: '' };
}

// The approve form's editable fields, kept separate from FraccionamientoDetail: the detail also
// carries read-only fields (Latitude/Longitude/Status/Sources/...) that never belong in a PATCH
// body, and Amenities is edited here as a plain comma-separated string rather than the raw JSON
// array the backend stores it as (see amenitiesToText/textToAmenities).
interface ApproveFormValue {
  name: string;
  developerName: string;
  city: string;
  state: string;
  stage: string;
  description: string;
  amenitiesText: string;
  masterPlanImageUrl: string;
  contactPhone: string;
  contactEmail: string;
}

function emptyForm(): ApproveFormValue {
  return {
    name: '',
    developerName: '',
    city: '',
    state: '',
    stage: '',
    description: '',
    amenitiesText: '',
    masterPlanImageUrl: '',
    contactPhone: '',
    contactEmail: ''
  };
}

function amenitiesToText(json: string | null): string {
  if (!json) return '';
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string').join(', ') : '';
  } catch {
    return '';
  }
}

function textToAmenities(text: string): string | null {
  const items = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? JSON.stringify(items) : null;
}

function detailToForm(detail: FraccionamientoDetail): ApproveFormValue {
  return {
    name: detail.name,
    developerName: detail.developerName ?? '',
    city: detail.city,
    state: detail.state,
    stage: detail.stage ?? '',
    description: detail.description ?? '',
    amenitiesText: amenitiesToText(detail.amenitiesJson),
    masterPlanImageUrl: detail.masterPlanImageUrl ?? '',
    contactPhone: detail.contactPhone ?? '',
    contactEmail: detail.contactEmail ?? ''
  };
}

function formToApproveInput(form: ApproveFormValue): ApproveFraccionamientoInput {
  return {
    name: form.name.trim(),
    developerName: form.developerName.trim() || null,
    city: form.city.trim(),
    state: form.state.trim(),
    stage: form.stage.trim() || null,
    description: form.description.trim() || null,
    amenitiesJson: textToAmenities(form.amenitiesText),
    masterPlanImageUrl: form.masterPlanImageUrl.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    contactEmail: form.contactEmail.trim() || null
  };
}

// "19.04, -98.20" (comma or whitespace-separated, e.g. pasted straight from Google Maps'
// coordinate display) → { latitude, longitude }, or null if it isn't two valid numbers within
// real coordinate range.
function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const parts = text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function formToCreateInput(form: AddFormValue, coordinates: { latitude: number; longitude: number }): CreateFraccionamientoInput {
  return {
    name: form.name.trim(),
    developerName: form.developerName.trim() || null,
    city: form.city.trim(),
    state: form.state.trim(),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    stage: form.stage.trim() || null
  };
}

@Component({
  selector: 'app-admin-fraccionamientos',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './admin-fraccionamientos.component.html',
  styleUrl: './admin-fraccionamientos.component.css'
})
export class AdminFraccionamientosComponent implements OnInit {
  readonly items = signal<FraccionamientoListItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly statusFilter = signal<StatusFilter>('Candidate');
  readonly page = signal(1);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[1]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly expandedId = signal<string | null>(null);
  readonly expandedDetail = signal<FraccionamientoDetail | null>(null);
  readonly loadingDetail = signal(false);
  readonly form = signal<ApproveFormValue>(emptyForm());
  readonly mergeTargetId = signal('');

  readonly approving = signal(false);
  readonly rejecting = signal(false);
  readonly merging = signal(false);

  readonly showAddForm = signal(false);
  readonly addForm = signal<AddFormValue>(emptyAddForm());
  readonly creating = signal(false);

  // Bumped on every load() call and captured per-request — same guard as admin-errors, so a
  // slower response from a filter/page change fired earlier can't overwrite items()/totalCount()
  // with data that no longer matches the currently-selected filter/page.
  private loadSequence = 0;

  constructor(
    private readonly fraccionamientoService: FraccionamientoService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setFilter(filter: StatusFilter): void {
    if (filter === this.statusFilter()) return;
    this.statusFilter.set(filter);
    this.page.set(1);
    this.expandedId.set(null);
    this.load();
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

  toggleExpanded(item: FraccionamientoListItem): void {
    if (this.expandedId() === item.id) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(item.id);
    this.expandedDetail.set(null);
    this.mergeTargetId.set('');
    this.loadingDetail.set(true);
    this.fraccionamientoService
      .getDetail(item.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          // The viewer may have collapsed this row (or expanded a different one) while the
          // request was in flight — only apply a response that's still for the row they're on.
          if (this.expandedId() !== item.id) return;
          this.expandedDetail.set(detail);
          this.form.set(detailToForm(detail));
        },
        error: () => this.notification.error('adminFraccionamientos.loadError')
      });
  }

  updateForm<K extends keyof ApproveFormValue>(field: K, value: ApproveFormValue[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  approve(id: string): void {
    if (this.approving()) return;
    this.approving.set(true);
    this.fraccionamientoService
      .approve(id, formToApproveInput(this.form()))
      .pipe(finalize(() => this.approving.set(false)))
      .subscribe({
        next: () => {
          this.expandedId.set(null);
          this.load();
        },
        error: () => this.notification.error('adminFraccionamientos.approveError')
      });
  }

  reject(id: string): void {
    if (this.rejecting()) return;
    this.rejecting.set(true);
    this.fraccionamientoService
      .reject(id)
      .pipe(finalize(() => this.rejecting.set(false)))
      .subscribe({
        next: () => {
          this.expandedId.set(null);
          this.load();
        },
        error: () => this.notification.error('adminFraccionamientos.rejectError')
      });
  }

  merge(id: string): void {
    const target = this.mergeTargetId().trim();
    if (!target || this.merging()) return;

    this.merging.set(true);
    this.fraccionamientoService
      .merge(id, target)
      .pipe(finalize(() => this.merging.set(false)))
      .subscribe({
        next: () => {
          this.expandedId.set(null);
          this.load();
        },
        error: () => this.notification.error('adminFraccionamientos.mergeError')
      });
  }

  toggleAddForm(): void {
    this.showAddForm.update((v) => !v);
    if (this.showAddForm()) this.addForm.set(emptyAddForm());
  }

  updateAddForm<K extends keyof AddFormValue>(field: K, value: AddFormValue[K]): void {
    this.addForm.update((current) => ({ ...current, [field]: value }));
  }

  submitAdd(): void {
    if (this.creating()) return;

    const form = this.addForm();
    if (!form.name.trim() || !form.city.trim() || !form.state.trim()) {
      this.notification.error('adminFraccionamientos.addIncomplete');
      return;
    }

    const coordinates = parseCoordinates(form.coordinates);
    if (!coordinates) {
      this.notification.error('adminFraccionamientos.addInvalidCoordinates');
      return;
    }

    this.creating.set(true);
    this.fraccionamientoService
      .create(formToCreateInput(form, coordinates))
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (result) => {
          this.showAddForm.set(false);
          this.notification.success(
            result.matchedExisting ? 'adminFraccionamientos.addMatchedExisting' : 'adminFraccionamientos.addSuccess'
          );
          // 'all' rather than staying on the current filter: a match can land the record in any
          // non-MergedInto status (e.g. it matched something already Published), not necessarily
          // Candidate, so this is the only filter guaranteed to make it visible right away.
          this.statusFilter.set('all');
          this.page.set(1);
          this.load();
        },
        error: () => this.notification.error('adminFraccionamientos.addError')
      });
  }

  private load(): void {
    this.loading.set(true);
    // Read once into a local: narrowing `filter === 'all' ? undefined : filter` only works on a
    // plain variable — calling the signal a second time (this.statusFilter()) isn't narrowed by
    // the first call's check, so TypeScript still sees the 'all' member on the "else" branch.
    const filter = this.statusFilter();
    const status = filter === 'all' ? undefined : filter;
    const pageSize = this.pageSize();
    const sequence = ++this.loadSequence;

    this.fraccionamientoService
      .list({ status, page: this.page(), pageSize })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          if (sequence !== this.loadSequence) return;

          // Same self-correction as admin-errors: approving/rejecting the last item on the last
          // page would otherwise leave the viewer stranded on a now-empty page.
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
          this.notification.error('adminFraccionamientos.loadError');
        }
      });
  }
}
