/** Wowhead base path. The committed data is TBC-era, so default to that database. */
export const WOWHEAD_BASE = 'https://www.wowhead.com/tbc/'

/**
 * Link to an item by ID, with no profession rule involved.
 *
 * Used by both apps: the recipe registry (via the profession-aware rule in
 * `Recipes/src/search.ts`) and the P3 loot prio table, whose rows are raid
 * drops — unambiguously items, so no spell/item split is needed here.
 */
export function wowheadItemUrl(itemId: number): string {
  return `${WOWHEAD_BASE}item=${itemId}`
}
