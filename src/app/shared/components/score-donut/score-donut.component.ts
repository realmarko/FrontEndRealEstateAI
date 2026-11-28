import { Component, computed, input } from '@angular/core';

// A 0-100 score (today: viability/residential-analysis business-type scores) as a radial
// progress ring instead of a flat colored pill — first used by listing-detail's and
// viability-report-page's own near-identical good/medium/low score badges, extracted here once
// it repeated across those two pages rather than duplicating the conic-gradient CSS a second time.
@Component({
  selector: 'app-score-donut',
  standalone: true,
  templateUrl: './score-donut.component.html',
  styleUrl: './score-donut.component.css'
})
export class ScoreDonutComponent {
  readonly score = input.required<number>();

  protected readonly status = computed<'good' | 'medium' | 'low'>(() => {
    const value = this.score();
    if (value > 80) return 'good';
    if (value >= 40) return 'medium';
    return 'low';
  });
}
