import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ZONE_ANALYSIS_ZONES, ZoneAnalysisZone } from '../zone-analysis-data';

interface ZoneGroup {
  state: string;
  zones: ZoneAnalysisZone[];
}

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
  // Grouped by state, in ZONE_ANALYSIS_ZONES's own order (Puebla, Tlaxcala, Querétaro today) —
  // groups by first appearance rather than alphabetically, so adding a new state's zones later
  // doesn't reshuffle the page.
  readonly zoneGroups: ZoneGroup[] = ZONE_ANALYSIS_ZONES.reduce<ZoneGroup[]>((groups, zone) => {
    const group = groups.find((g) => g.state === zone.state);
    if (group) {
      group.zones.push(zone);
    } else {
      groups.push({ state: zone.state, zones: [zone] });
    }
    return groups;
  }, []);

  constructor(protected readonly translation: TranslationService, seo: SeoService) {
    seo.set({
      title: translation.t('zoneAnalysisHub.seoTitle'),
      description: translation.t('zoneAnalysisHub.seoDescription'),
      path: translation.path('zoneAnalysis'),
      hreflang: translation.hreflangPaths('zoneAnalysis')
    });
  }
}
