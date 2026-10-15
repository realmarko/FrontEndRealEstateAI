import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  constructor(protected readonly auth: AuthService, seo: SeoService) {
    seo.set({
      title: 'Casas, departamentos y terrenos en venta y renta',
      description: 'Encuentra tu próxima propiedad en México: casas, departamentos y terrenos en venta y renta, con agentes e inmobiliarias verificadas.',
      path: '/'
    });
  }
}
