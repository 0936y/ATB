import { describe, expect, it } from 'vitest'
import { loadAllEntries, loadCommittedExports, loadRegistryChunks } from './loadExports'
import { buildIndex } from '../search'

// The loaders are async now that the data globs are lazy chunks rather than
// eager inlines — see loadExports.ts.
const exports = await loadCommittedExports()
const registry = await loadRegistryChunks()
const all = await loadAllEntries()

describe('the committed recipes.json registry', () => {
  it('loads and covers all seven professions', () => {
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

  it('holds 1118 distinct recipes across 24 crafters', () => {
    expect(new Set(registry.flatMap((c) => c.recipes.map((r) => r.id))).size).toBe(1118)
    expect(new Set(registry.map((c) => c.crafter)).size).toBe(24)
  })
})

describe('loadAllEntries', () => {
  it('is a superset of both sources — the union loses nothing', () => {
    // This is the guard that matters: recipes.json is NOT a superset of the
    // addon exports (8 spell IDs appear only there), so replacing rather than
    // unioning would silently drop data.
    const key = (crafter: string, id: number) => `${crafter.toLowerCase()}|${id}`
    const pairs = (entries: typeof all) =>
      new Set(entries.flatMap((e) => e.recipes.map((r) => key(e.crafter, r.id))))

    const union = pairs(all)
    for (const p of pairs(exports)) expect(union.has(p)).toBe(true)
    for (const p of pairs(registry)) expect(union.has(p)).toBe(true)
  })

  it('keeps the 8 recipes that exist only in the addon exports', () => {
    const onlyInExports = [23109, 25686, 25687, 30041, 30044, 30045, 32508, 32776]
    const registryIds = new Set(registry.flatMap((c) => c.recipes.map((r) => r.id)))
    const allIds = new Set(all.flatMap((e) => e.recipes.map((r) => r.id)))

    for (const id of onlyInExports) {
      expect(registryIds.has(id)).toBe(false) // absent from recipes.json
      expect(allIds.has(id)).toBe(true) // but present after the union
    }
  })

  it('dedupes the heavy overlap rather than double-counting', () => {
    for (const entry of all) {
      const ids = entry.recipes.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('indexes to 1126 distinct recipes (1118 registry + 8 export-only)', () => {
    expect(new Set(all.flatMap((e) => e.recipes.map((r) => r.id))).size).toBe(1126)
  })

  it('credits Slavongîga with recipes from both sources', () => {
    const ids = new Set(
      all.filter((e) => e.crafter === 'Slavongîga').flatMap((e) => e.recipes.map((r) => r.id)),
    )
    expect(ids.has(32776)).toBe(true) // export-only: Crown of the Sea Witch
    expect(ids.size).toBe(212)
  })

  it('produces an index where shared recipes list every crafter', () => {
    const index = buildIndex(all)
    const shared = index.filter((m) => m.crafters.length > 1)
    expect(shared.length).toBeGreaterThan(0)
    for (const m of shared) expect(new Set(m.crafters).size).toBe(m.crafters.length)
  })
})
