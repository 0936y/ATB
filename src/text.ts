/**
 * Fold accents and case so `Slavongîga` is findable by typing `slavongiga`.
 *
 * Shared by both searchable tables — the recipe registry and the P3 loot prio
 * list — so one query behaves the same on either page.
 */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
