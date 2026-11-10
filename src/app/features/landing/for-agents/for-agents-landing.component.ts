import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-for-agents-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './for-agents-landing.component.html',
  styleUrl: './for-agents-landing.component.css'
})
export class ForAgentsLandingComponent {
  constructor(protected readonly translation: TranslationService, seo: SeoService) {
    seo.set({
      title: 'Para agentes e inmobiliarias',
      description:
        'Publica tu cartera con datos reales de mercado (INEGI/DENUE) sobre el mapa, gestiona tu inmobiliaria y recibe contactos directos de compradores.',
      path: translation.path('forAgents'),
      hreflang: translation.hreflangPaths('forAgents')
    });
  }
}
