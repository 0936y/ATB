import { describe, expect, it } from 'vitest'
import { consolidate, serializeRegistry } from './consolidate'
import type { JsonRegistry } from './jsonRegistry'
import type { CrafterProfession } from '../types'

const base: JsonRegistry = {
  '100': { name: 'Potion', profession: 'Alchemy', crafters: ['Alpha'] },
  '200': { name: 'Bolt', profession: 'Tailoring', crafters: ['Alpha', 'Beta'] },
}

function entry(crafter: string, profession: string, recipes: [string, number][]): CrafterProfession {
  return { crafter, profession, recipes: recipes.map(([name, id]) => ({ name, id })) }
}

describe('consolidate', () => {
  it('adds recipe IDs the registry has never seen', () => {
    const { registry, summary } = consolidate(base, [
      entry('Gamma', 'Alchemy', [['Elixir', 300]]),
    ])
    expect(registry['300']).toEqual({ name: 'Elixir', profession: 'Alchemy', crafters: ['Gamma'] })
    expect(summary.newRecipes).toHaveLength(1)
    expect(summary.newCredits).toHaveLength(0)
  })

  it('credits a new crafter on an existing recipe without touching its name', () => {
    const { registry, summary } = consolidate(base, [entry('Gamma', 'Alchemy', [['Potion', 100]])])
    expect(registry['100'].crafters).toEqual(['Alpha', 'Gamma'])
    expect(summary.newCredits).toHaveLength(1)
    expect(summary.newRecipes).toHaveLength(0)
  })

  it('skips a recipe the crafter already has (the re-export case)', () => {
    const { registry, summary } = consolidate(base, [entry('Alpha', 'Alchemy', [['Potion', 100]])])
    expect(registry['100'].crafters).toEqual(['Alpha'])
    expect(summary.duplicates).toBe(1)
    expect(summary.newRecipes).toHaveLength(0)
    expect(summary.newCredits).toHaveLength(0)
  })

  it('matches crafters case-insensitively but accent-sensitively', () => {
    const { summary } = consolidate(
      { '100': { name: 'Potion', profession: 'Alchemy', crafters: ['Slavongîga'] } },
      [
        entry('slavongîga', 'Alchemy', [['Potion', 100]]), // same char, different case → dup
        entry('Slavongiga', 'Alchemy', [['Potion', 100]]), // no circumflex → distinct crafter
      ],
    )
    expect(summary.duplicates).toBe(1)
    expect(summary.newCredits).toHaveLength(1)
  })

  it('never mutates the input registry', () => {
    const snapshot = JSON.stringify(base)
    consolidate(base, [entry('Gamma', 'Alchemy', [['Potion', 100], ['New', 999]])])
    expect(JSON.stringify(base)).toBe(snapshot)
  })

  it('serializes with numeric-sorted keys, two-space indent, trailing newline', () => {
    const out = serializeRegistry({
      '200': { name: 'B', profession: 'Tailoring', crafters: [] },
      '100': { name: 'A', profession: 'Alchemy', crafters: [] },
    })
    expect(out.endsWith('\n')).toBe(true)
    expect(out.indexOf('"100"')).toBeLessThan(out.indexOf('"200"'))
    expect(out).toContain('\n  "100": {')
  })
})
