import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEFAULT_LISTING_IMAGE, Listing } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../../shared/utils/mortgage';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, TranslatePipe],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.css'
})
export class ListingCardComponent {
  @Input({ required: true }) listing!: Listing;
  @Input() isFavorite = false;
  @Output() toggleFavorite = new EventEmitter<string>();

  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;
  readonly activeImageIndex = signal(0);

  showImage(index: number): void {
    this.activeImageIndex.set(index);
  }

  // Same default assumptions as MortgageCalculatorComponent (20% down, 10.5%, 30yr) — this
  // is a quick informational estimate on the card, not an editable calculator.
  get estimatedMonthlyPayment(): number {
    return calculateMonthlyPayment(
      this.listing.price,
      DEFAULT_DOWN_PAYMENT_PERCENT,
      DEFAULT_INTEREST_RATE_PERCENT,
      DEFAULT_TERM_YEARS
    );
  }
}
