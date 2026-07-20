import { describe, expect, it } from 'vitest'
import { buildIndex, searchRecipes, wowheadKind, wowheadUrl } from './search'
import type { CrafterProfession } from './types'

const entries: CrafterProfession[] = [
  {
    crafter: 'Slavongiga',
    profession: 'Enchanting',
    recipes: [
      { name: 'Enchant Weapon - Sunfire', id: 27981 },
      { name: 'Enchant Gloves - Major Healing', id: 33999 },
    ],
  },
  {
    crafter: 'Slavongîga',
    profession: 'Jewelcrafting',
    recipes: [{ name: 'Brilliant Glass', id: 35945 }],
  },
  {
    crafter: 'Otherguy',
    profession: 'Enchanting',
    recipes: [{ name: 'Enchant Weapon - Sunfire', id: 27981 }],
  },
]

const index = buildIndex(entries)

describe('buildIndex', () => {
  it('collapses a shared recipe into one row listing both crafters', () => {
    const sunfire = index.find((m) => m.id === 27981)!
    expect(sunfire.crafters).toEqual(['Slavongiga', 'Otherguy'])
  })

  it('produces one row per distinct recipe', () => {
    expect(index).toHaveLength(3)
  })

  it('sorts rows by recipe name', () => {
    expect(index.map((m) => m.name)).toEqual([
      'Brilliant Glass',
      'Enchant Gloves - Major Healing',
      'Enchant Weapon - Sunfire',
    ])
  })
})

describe('searchRecipes', () => {
  it('returns everything for an empty query', () => {
    expect(searchRecipes(index, {})).toHaveLength(3)
    expect(searchRecipes(index, { query: '   ' })).toHaveLength(3)
  })

  it('matches case-insensitively on a substring', () => {
    expect(searchRecipes(index, { query: 'SUNFIRE' })).toHaveLength(1)
    expect(searchRecipes(index, { query: 'glass' })[0].name).toBe('Brilliant Glass')
  })

  it('filters by profession', () => {
    expect(searchRecipes(index, { profession: 'Enchanting' })).toHaveLength(2)
  })

  it('filters by crafter', () => {
    expect(searchRecipes(index, { crafter: 'Otherguy' })).toHaveLength(1)
  })

  it('combines query and filters', () => {
    expect(searchRecipes(index, { query: 'enchant', profession: 'Enchanting' })).toHaveLength(2)
    expect(searchRecipes(index, { query: 'glass', profession: 'Enchanting' })).toHaveLength(0)
  })

  it('finds an accented crafter by an unaccented query', () => {
    const jc = buildIndex([entries[1]])
    expect(searchRecipes(jc, { crafter: 'Slavongîga' })).toHaveLength(1)
  })

  it('returns nothing for a query that matches no recipe', () => {
    expect(searchRecipes(index, { query: 'zzzzz' })).toEqual([])
  })
})

describe('wowheadUrl', () => {
  it('uses spell= for Enchanting, which exports spell IDs', () => {
    expect(wowheadUrl(27981, 'Enchanting')).toBe('https://www.wowhead.com/tbc/spell=27981')
  })

  it('uses item= for professions that produce an item', () => {
    // Regression guard: item 35945 is "Brilliant Glass"; spell 35945 is the
    // unrelated "Incendiary Shot".
    expect(wowheadUrl(35945, 'Jewelcrafting')).toBe('https://www.wowhead.com/tbc/item=35945')
    expect(wowheadUrl(25686, 'Leatherworking')).toBe('https://www.wowhead.com/tbc/item=25686')
    expect(wowheadUrl(22835, 'Alchemy')).toBe('https://www.wowhead.com/tbc/item=22835')
  })

  it('matches profession case-insensitively', () => {
    expect(wowheadKind('enchanting')).toBe('spell')
    expect(wowheadKind('ENCHANTING')).toBe('spell')
    expect(wowheadKind('Tailoring')).toBe('item')
  })
})
