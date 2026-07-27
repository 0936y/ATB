import { describe, expect, it } from 'vitest'
import { loadAllEntries, loadRegistryChunks } from './loadExports'
import { buildIndex } from '../search'

// The loaders are async now that the registry glob is a lazy chunk rather than
// an eager inline — see loadExports.ts. recipes.json is the single source of
// truth; addon exports are folded into it by `npm run import` before runtime.
const registry = await loadRegistryChunks()
const all = await loadAllEntries()

describe('the committed recipes.json registry', () => {
  it('covers all seven professions', () => {
    expect([...new Set(registry.map((c) => c.profession))].sort()).toEqual([
      'Alchemy',
      'Blacksmithing',
      'Enchanting',
      'Engineering',
      'Jewelcrafting',
      'Leatherworking',
      'Tailoring',
    ])
  })

  it('parses every entry without warnings', () => {
    expect(registry.flatMap((c) => c.warnings)).toEqual([])
  })

  // Load-bearing counts: a bad `npm run import` (truncated paste, lossy merge)
  // moves these. Update them deliberately when the registry legitimately grows.
  it('holds 1131 distinct recipes across 25 crafters', () => {
    expect(new Set(all.flatMap((e) => e.recipes.map((r) => r.id))).size).toBe(1131)
    expect(new Set(all.map((c) => c.crafter)).size).toBe(25)
  })

  it('includes recipes that came from the addon exports', () => {
    const allIds = new Set(all.flatMap((e) => e.recipes.map((r) => r.id)))
    // Export-only IDs the original registry never knew (e.g. Crown of the Sea
    // Witch #32776, Fel Leather Boots #25686) are now folded in.
    for (const id of [25686, 30044, 32776, 34220]) expect(allIds.has(id)).toBe(true)
  })

  it('credits Evonte, an Engineering crafter added via export import', () => {
    const evonte = all.filter((e) => e.crafter === 'Evonte')
    expect(evonte.map((e) => e.profession).sort()).toEqual(['Enchanting', 'Engineering'])
  })
})

describe('loadAllEntries', () => {
  it('dedupes recipes per crafter rather than double-counting', () => {
    for (const entry of all) {
      const ids = entry.recipes.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('produces an index where shared recipes list every crafter once', () => {
    const index = buildIndex(all)
    const shared = index.filter((m) => m.crafters.length > 1)
    expect(shared.length).toBeGreaterThan(0)
    for (const m of shared) expect(new Set(m.crafters).size).toBe(m.crafters.length)
  })
})
