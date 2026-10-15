import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css'
})
export class TermsComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Términos y condiciones',
      description: 'Términos y condiciones de uso de Espacial.com.mx.',
      path: '/terms'
    });
  }
}
