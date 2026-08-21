import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Listing } from '../../../core/models/listing.model';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.css'
})
export class ListingCardComponent {
  @Input({ required: true }) listing!: Listing;
  @Input() isFavorite = false;
  @Output() toggleFavorite = new EventEmitter<string>();
}
