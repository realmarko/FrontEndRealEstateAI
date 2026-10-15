import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.css'
})
export class PrivacyComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Aviso de privacidad',
      description: 'Aviso de privacidad de Espacial.com.mx.',
      path: '/privacy'
    });
  }
}
