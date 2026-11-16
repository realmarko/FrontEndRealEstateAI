import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ZONE_ANALYSIS_ZONES } from '../zone-analysis-data';

// Static content hub, no backend calls — fully prerendered (falls through app.routes.server.ts's
// catch-all) so its internal links to each zone's own page carry full SEO/crawl weight. Each
// zone's own numbers live only on its detail page (zone-analysis-detail.component.ts), which is
// deliberately client-rendered to avoid the DENUE-quota cost of baking them into every build.
@Component({
  selector: 'app-zone-analysis-hub',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './zone-analysis-hub.component.html',
  styleUrl: './zone-analysis-hub.component.css'
})
export class ZoneAnalysisHubComponent {
  readonly zones = ZONE_ANALYSIS_ZONES;

  constructor(protected readonly translation: TranslationService, seo: SeoService) {
    seo.set({
      title: translation.t('zoneAnalysisHub.seoTitle'),
      description: translation.t('zoneAnalysisHub.seoDescription'),
      path: translation.path('zoneAnalysis'),
      hreflang: translation.hreflangPaths('zoneAnalysis')
    });
  }
}
