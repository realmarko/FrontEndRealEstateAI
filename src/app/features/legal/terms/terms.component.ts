import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css'
})
export class TermsComponent {
  constructor() {
    const translation = inject(TranslationService);
    inject(SeoService).set({
      title: 'Términos y condiciones',
      description: 'Términos y condiciones de uso de Espacial.com.mx.',
      path: translation.path('terms'),
      hreflang: translation.hreflangPaths('terms')
    });
  }
}
