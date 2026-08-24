import { describe, expect, it } from 'vitest'
import { bossesOf, filterLoot, loadLootPrio, raidsOf } from './lootData'
import type { LootPrioItem } from './types'

const items: LootPrioItem[] = [
  {
    name: 'Cuffs of Devastation',
    itemId: 30870,
    quality: 4,
    raid: 'Mount Hyjal',
    boss: 'Rage Winterchill',
    prio: ['Arcane', 'Balance', 'Ele'],
    notes: '',
  },
  {
    name: 'Blessed Band of Karabor',
    itemId: 32266,
    quality: 4,
    raid: 'Black Temple',
    boss: 'Trash',
    prio: ['Resto Dru (if non LW/Tailor)', 'Resto Sha, Holy Pri'],
    notes: 'Leatherworking and tailoring have bop haste shoulders.',
  },
  {
    name: 'Belt of Deep Shadow',
    itemId: 32586,
    quality: 4,
    raid: 'Crafted',
    boss: '',
    prio: ['Rogue'],
    notes: '',
  },
]

describe('filterLoot', () => {
  it('returns everything with no filters', () => {
    expect(filterLoot(items, {})).toHaveLength(3)
  })

  it('matches on item name', () => {
    expect(filterLoot(items, { query: 'cuffs' }).map((i) => i.name)).toEqual([
      'Cuffs of Devastation',
    ])
  })

  // The whole reason priority cells are searchable: there is no spec dropdown to
  // build from free text like "Resto Dru (if non LW/Tailor)".
  it('matches on a spec inside the priority list', () => {
    expect(filterLoot(items, { query: 'balance' }).map((i) => i.name)).toEqual([
      'Cuffs of Devastation',
    ])
  })

  it('matches on boss and on note text', () => {
    expect(filterLoot(items, { query: 'winterchill' })).toHaveLength(1)
    expect(filterLoot(items, { query: 'tailoring' })).toHaveLength(1)
  })

  it('folds accents and case like the recipe search does', () => {
    expect(filterLoot(items, { query: 'DEVASTATION' })).toHaveLength(1)
  })

  it('narrows by raid and by boss, and combines with the query', () => {
    expect(filterLoot(items, { raid: 'Black Temple' })).toHaveLength(1)
    expect(filterLoot(items, { boss: 'Trash' })).toHaveLength(1)
    expect(filterLoot(items, { raid: 'Mount Hyjal', query: 'karabor' })).toHaveLength(0)
  })
})

describe('raidsOf / bossesOf', () => {
  it('lists each raid once, in source order', () => {
    expect(raidsOf(items)).toEqual(['Mount Hyjal', 'Black Temple', 'Crafted'])
  })

  it('scopes bosses to the selected raid', () => {
    expect(bossesOf(items, 'Mount Hyjal')).toEqual(['Rage Winterchill'])
  })

  // Crafted gear has no boss; an empty option in the dropdown would be a dud.
  it('drops the empty boss of crafted rows', () => {
    expect(bossesOf(items)).toEqual(['Rage Winterchill', 'Trash'])
  })
})

/**
 * The committed snapshot of https://www.tbcguides.gg/p3-loot-prio/.
 *
 * Every item ID here was resolved against Wowhead's TBC database and verified to
 * return a tooltip, so a row missing an ID means the data was edited lossily —
 * the link would silently 404 into Wowhead's "item not found" page.
 */
describe('the committed P3 loot list', () => {
  it('loads every scraped row with a resolved Wowhead item', async () => {
    const loaded = await loadLootPrio()

    expect(loaded).toHaveLength(217)
    for (const item of loaded) {
      expect(item.name).not.toBe('')
      expect(item.itemId).toBeGreaterThan(0)
      expect(item.quality).toBeGreaterThanOrEqual(1)
      expect(item.raid).not.toBe('')
    }
  })

  it('covers both Phase 3 raids plus crafted gear', async () => {
    expect(raidsOf(await loadLootPrio()).sort()).toEqual([
      'Black Temple',
      'Crafted',
      'Mount Hyjal',
    ])
  })
})
