const WINDOW_MS = 24 * 60 * 60 * 1000; // once per browser per day, per page

// Shared by agent-detail and listing-detail: decides whether this page load should call its
// detail service's recordView() — the backend counter itself isn't deduplicated (see
// AgentsController/ListingsController.RecordView), so without this every refresh would inflate
// the count. Returns false (and records nothing) on read/write failure — a blocked or
// unavailable localStorage (private browsing, cleared site data) should degrade to "don't count
// this view" rather than throw and break the page.
export function shouldRecordView(key: string): boolean {
  const storageKey = `reapp_viewed_${key}`;
  try {
    const last = localStorage.getItem(storageKey);
    if (last && Date.now() - Number(last) < WINDOW_MS) return false;
    localStorage.setItem(storageKey, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
