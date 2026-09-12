import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  templateUrl: './rating-stars.component.html',
  styleUrl: './rating-stars.component.css'
})
export class RatingStarsComponent {
  @Input({ required: true }) rating!: number;

  get filledStars(): number {
    return Math.round(this.rating);
  }

  get stars(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
