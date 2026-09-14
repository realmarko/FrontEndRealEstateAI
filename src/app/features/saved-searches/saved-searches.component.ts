import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedSearchService } from '../../core/services/saved-search.service';
import { SavedSearch } from '../../core/models/saved-search.model';
import { NotificationService } from '../../core/services/notification.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-saved-searches',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CurrencyPipe],
  templateUrl: './saved-searches.component.html',
  styleUrl: './saved-searches.component.css'
})
export class SavedSearchesComponent implements OnInit {
  constructor(
    readonly savedSearchService: SavedSearchService,
    private readonly notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.savedSearchService.refresh();
  }

  delete(search: SavedSearch): void {
    this.savedSearchService.delete(search.id).subscribe({
      next: () => this.notification.success('savedSearches.deleted'),
      error: () => this.notification.error('savedSearches.deleteError')
    });
  }
}
