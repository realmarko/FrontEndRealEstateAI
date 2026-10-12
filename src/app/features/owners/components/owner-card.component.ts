import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Owner } from '../../../core/models/owner.model';
import { toSlug } from '../../../core/services/owner-api.adapter';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-owner-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './owner-card.component.html',
  styleUrl: './owner-card.component.css'
})
export class OwnerCardComponent {
  @Input({ required: true }) owner!: Owner;

  protected readonly auth = inject(AuthService);

  get slug(): string {
    return toSlug(this.owner.name);
  }

  get initials(): string {
    return this.owner.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
