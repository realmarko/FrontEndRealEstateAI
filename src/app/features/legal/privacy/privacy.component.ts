import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.css'
})
export class PrivacyComponent {
  constructor() {
    const translation = inject(TranslationService);
    inject(SeoService).set({
      title: 'Aviso de privacidad',
      description: 'Aviso de privacidad de Espacial.com.mx.',
      path: translation.path('privacy'),
      hreflang: translation.hreflangPaths('privacy')
    });
  }
}
