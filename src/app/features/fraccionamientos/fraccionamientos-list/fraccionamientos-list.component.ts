import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FraccionamientoService } from '../../../core/services/fraccionamiento.service';
import { FraccionamientoPublicListItem } from '../../../core/models/fraccionamiento.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-fraccionamientos-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe, SkeletonLoaderComponent, StatePanelComponent],
  templateUrl: './fraccionamientos-list.component.html',
  styleUrl: './fraccionamientos-list.component.css'
})
export class FraccionamientosListComponent implements OnInit {
  readonly items = signal<FraccionamientoPublicListItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly page = signal(1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  // Same guard as admin-fraccionamientos: a slower response from a page change fired earlier
  // must not overwrite items()/totalCount() with data for a page the visitor already left.
  private loadSequence = 0;

  constructor(private readonly fraccionamientoService: FraccionamientoService) {}

  ngOnInit(): void {
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const sequence = ++this.loadSequence;

    this.fraccionamientoService.listPublished({ page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: (result) => {
        if (sequence !== this.loadSequence) return;
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        if (sequence !== this.loadSequence) return;
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }
}
