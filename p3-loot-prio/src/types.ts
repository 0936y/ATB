/**
 * One row of the Phase 3 loot priority list.
 *
 * Scraped from https://www.tbcguides.gg/p3-loot-prio/ (the table below "Last
 * update made as of Jan 26th."). The source table shows plain item names; the
 * `itemId`/`quality` fields are ours — resolved against Wowhead's TBC database
 * so the name can be rendered as a real tooltip link.
 */
export interface LootPrioItem {
  /** Item name exactly as the source table spells it — see `name` note below. */
  name: string
  /** Wowhead TBC item ID. */
  itemId: number
  /** Wowhead quality tier (4 = epic, 5 = legendary). Drives the fallback colour. */
  quality: number
  /** "Black Temple", "Mount Hyjal" or "Crafted". */
  raid: string
  /** Boss name, "Trash", or empty for crafted gear. */
  boss: string
  /** Specs in priority order, highest first. Empty trailing slots are dropped. */
  prio: string[]
  /** Free-text caveat from the source table. Often empty. */
  notes: string
}
