import type { CrafterProfession, RecipeMatch } from './types'
import { fold } from '../../src/shared/text'
import { WOWHEAD_BASE } from '../../src/shared/wowheadLinks'

/**
 * Collapse every crafter's list into one row per (id, profession),
 * carrying the set of crafters who know it — that is the "who can craft X?"
 * answer the guild actually wants.
 */
export function buildIndex(entries: CrafterProfession[]): RecipeMatch[] {
  const index = new Map<string, RecipeMatch>()

  for (const entry of entries) {
    for (const recipe of entry.recipes) {
      const key = `${entry.profession.toLowerCase()}|${recipe.id}`
      const existing = index.get(key)
      if (existing) {
        if (!existing.crafters.includes(entry.crafter)) existing.crafters.push(entry.crafter)
      } else {
        index.set(key, {
          name: recipe.name,
          id: recipe.id,
          profession: entry.profession,
          crafters: [entry.crafter],
        })
      }
    }
  }

  return [...index.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface SearchFilters {
  query?: string
  profession?: string
  crafter?: string
}

/** Substring match on recipe name, plus optional profession/crafter narrowing. */
export function searchRecipes(index: RecipeMatch[], filters: SearchFilters): RecipeMatch[] {
  const q = fold(filters.query?.trim() ?? '')

  return index.filter((match) => {
    if (q && !fold(match.name).includes(q)) return false
    if (filters.profession && match.profession !== filters.profession) return false
    if (filters.crafter && !match.crafters.includes(filters.crafter)) return false
    return true
  })
}

/**
 * The addon does NOT export spell IDs uniformly.
 *
 * Enchanting recipes produce no item, so the addon exports the *spell* ID. Every
 * other profession produces a physical item, and the addon exports that *item*
 * ID. Using the wrong endpoint silently resolves to an unrelated entry — item
 * 25686 is "Fel Leather Boots" but spell 25686 is "Super Snowball".
 *
 * Verified against Wowhead's TBC tooltip API for all 1126 committed recipes:
 * this rule resolves every one of them.
 */
export function wowheadKind(profession: string): 'spell' | 'item' {
  return profession.toLowerCase() === 'enchanting' ? 'spell' : 'item'
}

export function wowheadUrl(id: number, profession: string): string {
  return `${WOWHEAD_BASE}${wowheadKind(profession)}=${id}`
}
