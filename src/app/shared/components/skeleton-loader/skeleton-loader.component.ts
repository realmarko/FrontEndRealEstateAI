import { Component, Input } from '@angular/core';

// Shared shimmering placeholder for any page's initial-load state — introduced after messages
// and favorites independently grew byte-for-byte identical skeleton CSS (including the
// @keyframes animation) for their list and grid loading states respectively.
@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.css'
})
export class SkeletonLoaderComponent {
  @Input() variant: 'list' | 'grid' = 'list';
  @Input() count = 3;
  // Text lines per placeholder card (on top of the photo block for 'grid'). The first line is
  // always styled short and the last always medium, matching the two shapes this replaces
  // (messages: short/full/medium; favorites: short/medium).
  @Input() lines = 3;

  get rows(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }

  get lineIndexes(): number[] {
    return Array.from({ length: this.lines }, (_, i) => i);
  }
}
