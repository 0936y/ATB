import { describe, expect, it } from 'vitest'
import { registryToChunks, type JsonRegistry } from './jsonRegistry'
import { mergeChunks } from '../parser'

const registry: JsonRegistry = {
  '22835': { name: 'Elixir of Major Shadow Power', profession: 'Alchemy', crafters: ['Bulletdog', 'Zoremet'] },
  '35945': { name: 'Brilliant Glass', profession: 'Jewelcrafting', crafters: ['Zoremet'] },
}

describe('registryToChunks', () => {
  it('transposes recipe→crafters into one chunk per crafter/profession', () => {
    const chunks = registryToChunks(registry)
    expect(chunks).toHaveLength(3) // Bulletdog/Alchemy, Zoremet/Alchemy, Zoremet/Jewelcrafting
  })

  it('gives each crafter the recipes attributed to them', () => {
    const merged = mergeChunks(registryToChunks(registry))
    const zoremetAlchemy = merged.find((e) => e.crafter === 'Zoremet' && e.profession === 'Alchemy')!
    expect(zoremetAlchemy.recipes).toEqual([
      { name: 'Elixir of Major Shadow Power', id: 22835 },
    ])
  })

  it('keeps a crafter\'s professions separate', () => {
    const merged = mergeChunks(registryToChunks(registry))
    expect(merged.filter((e) => e.crafter === 'Zoremet').map((e) => e.profession).sort()).toEqual([
      'Alchemy',
      'Jewelcrafting',
    ])
  })

  it('collects malformed entries as warnings instead of throwing', () => {
    const bad = {
      notanumber: { name: 'X', profession: 'Alchemy', crafters: ['A'] },
      '111': { name: 'Y', profession: 'Alchemy', crafters: 'not an array' },
      '222': { name: 'Good', profession: 'Alchemy', crafters: ['A'] },
    } as unknown as JsonRegistry

    const chunks = registryToChunks(bad)
    const recipes = chunks.flatMap((c) => c.recipes)
    expect(recipes).toEqual([{ name: 'Good', id: 222 }])
    expect(chunks.flatMap((c) => c.warnings).sort()).toEqual(['111', 'notanumber'])
  })

  it('skips blank crafter names', () => {
    const chunks = registryToChunks({
      '1': { name: 'A', profession: 'Alchemy', crafters: ['', '  ', 'Real'] },
    })
    expect(chunks.map((c) => c.crafter)).toEqual(['Real'])
  })

  it('returns an empty array for an empty registry', () => {
    expect(registryToChunks({})).toEqual([])
  })
})
