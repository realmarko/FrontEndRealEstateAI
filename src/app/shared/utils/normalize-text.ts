// Strips accents/case so a typed value matches a catalog name regardless of spelling (e.g.
// "queretaro" should still match "Querétaro") — shared by the map's municipality search and the
// listing form's State/City catalog matching.
export function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
