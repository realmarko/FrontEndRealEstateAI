import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Agency } from '../../../core/models/agency.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agency-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './agency-card.component.html',
  styleUrl: './agency-card.component.css'
})
export class AgencyCardComponent {
  @Input({ required: true }) agency!: Agency;

  get initials(): string {
    return this.agency.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  get location(): string {
    return [this.agency.city, this.agency.state].filter(Boolean).join(', ');
  }
}
