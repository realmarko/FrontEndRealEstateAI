export interface PagePathViews {
  pathPattern: string;
  views: number;
}

// One week's worth of page views, pages ordered most-viewed first — see
// PageViewsController.Stats on the backend.
export interface WeeklyPageViews {
  weekStart: string;
  pages: PagePathViews[];
}
