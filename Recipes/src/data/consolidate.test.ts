import { describe, expect, it } from 'vitest'
import {
  consolidate,
  hasUnrecognizedExport,
  registryStats,
  serializeRegistry,
  serializeStats,
} from './consolidate'
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

describe('hasUnrecognizedExport', () => {
  it('flags a non-empty file set that produced zero chunks (garbage/unparseable upload)', () => {
    expect(hasUnrecognizedExport(1, 0)).toBe(true)
    expect(hasUnrecognizedExport(3, 0)).toBe(true)
  })

  it('does not flag a legitimate re-export that added nothing new (chunks > 0)', () => {
    expect(hasUnrecognizedExport(1, 1)).toBe(false)
    expect(hasUnrecognizedExport(2, 3)).toBe(false)
  })

  it('does not flag an empty exports folder (nothing was staged at all)', () => {
    expect(hasUnrecognizedExport(0, 0)).toBe(false)
  })
})

describe('registryStats', () => {
  it('counts distinct recipe IDs and distinct crafters', () => {
    expect(registryStats(base)).toEqual({ recipes: 2, crafters: 2 }) // Alpha, Beta
  })

  it('counts crafters case-insensitively', () => {
    const stats = registryStats({
      '1': { name: 'X', profession: 'Alchemy', crafters: ['Bob', 'bob', 'BOB'] },
    })
    expect(stats.crafters).toBe(1)
  })

  it('ignores non-numeric keys (they never reach the loader as recipes)', () => {
    const stats = registryStats({
      '1': { name: 'X', profession: 'Alchemy', crafters: ['Bob'] },
      bogus: { name: 'Y', profession: 'Alchemy', crafters: ['Eve'] },
    } as unknown as JsonRegistry)
    expect(stats.recipes).toBe(1)
    expect(stats.crafters).toBe(1)
  })

  it('reflects a growing registry after consolidate', () => {
    const { registry } = consolidate(base, [
      { crafter: 'Gamma', profession: 'Alchemy', recipes: [{ name: 'New', id: 300 }] },
    ])
    expect(registryStats(registry)).toEqual({ recipes: 3, crafters: 3 })
  })

  it('serializes a hand-editing-proof snapshot module', () => {
    const out = serializeStats({ recipes: 42, crafters: 7 })
    expect(out).toContain('export const REGISTRY_STATS = { recipes: 42, crafters: 7 } as const')
    expect(out).toContain('AUTO-GENERATED')
    expect(out.endsWith('\n')).toBe(true)
  })
})
