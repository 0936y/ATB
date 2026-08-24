import { fold } from '../../src/shared/text'
import type { LootPrioItem } from './types'

/**
 * The list is a static ~45 kB snapshot, dynamically imported so it lands in its
 * own chunk instead of the page shell — the same trade-off `loadExports.ts`
 * makes for `recipes.json`, and the reason this loader is async.
 */
export async function loadLootPrio(): Promise<LootPrioItem[]> {
  const rows = (await import('./p3-loot-prio.json')).default
  return rows as LootPrioItem[]
}

export interface LootFilters {
  query?: string
  raid?: string
  boss?: string
}

/**
 * Everything in a row is searchable, not just the item name.
 *
 * Priority cells are free text ("Resto Dru (if non LW/Tailor)", "MS > OS"), so
 * matching them is what makes "what does my spec want here?" answerable by
 * typing `resto` — there is no clean spec taxonomy to build a dropdown from.
 */
export function filterLoot(items: LootPrioItem[], filters: LootFilters): LootPrioItem[] {
  const q = fold(filters.query?.trim() ?? '')

  return items.filter((item) => {
    if (filters.raid && item.raid !== filters.raid) return false
    if (filters.boss && item.boss !== filters.boss) return false
    if (!q) return true

    const haystack = [item.name, item.raid, item.boss, item.notes, ...item.prio]
    return haystack.some((field) => fold(field).includes(q))
  })
}

/** Raids in the order they appear in the source table, deduped. */
export function raidsOf(items: LootPrioItem[]): string[] {
  return [...new Set(items.map((item) => item.raid))]
}

/**
 * Bosses for the boss dropdown, narrowed to one raid when it is selected.
 *
 * Kept in source order rather than alphabetical: the source table lists bosses
 * in kill order, which is how a raider thinks about them. Crafted rows carry an
 * empty boss and are filtered out.
 */
export function bossesOf(items: LootPrioItem[], raid?: string): string[] {
  const scoped = raid ? items.filter((item) => item.raid === raid) : items
  return [...new Set(scoped.map((item) => item.boss))].filter(Boolean)
}
