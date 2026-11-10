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

  // Deliberately a <button>, not an <a href="#id">: Angular's hydration event-dispatch queues the
  // (click) handler for replay, which runs too late to preventDefault() the browser's own native
  // anchor navigation — the href resolves against the app's base href ('/') and the visitor ends
  // up on the HOME page's '#como-funciona' instead of scrolling down this one. A button has no
  // navigation semantics to race against in the first place.
  // Deliberately a <button>, not an <a href="#id">: a plain fragment href on this site's
  // multi-page prerendered build resolves against the app's base href ('/') rather than the
  // current page, so clicking it from /para-agentes landed on the HOME page's '#como-funciona'
  // instead of scrolling down this one. A button has no navigation semantics to misfire.
  scrollToHowItWorks(): void {
    document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
