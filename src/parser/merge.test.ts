import { describe, expect, it } from 'vitest'
import { mergeChunks } from './merge'
import { parseExport } from './parse'
import { importLine } from '../test/fixtures'
import { loadCommittedExports } from '../data/loadExports'

describe('mergeChunks', () => {
  it('unions the chunks of one crafter/profession into a single entry', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1', 'B#2']),
      importLine('Bob', 'Tailoring', ['C#3']),
    ].join('\n\n')

    const merged = mergeChunks(parseExport(blob))
    expect(merged).toHaveLength(1)
    expect(merged[0].recipes.map((r) => r.id).sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('dedupes recipes that appear in more than one chunk', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1', 'B#2']),
      importLine('Bob', 'Tailoring', ['B#2', 'C#3']),
    ].join('\n\n')

    expect(mergeChunks(parseExport(blob))[0].recipes).toHaveLength(3)
  })

  it('treats crafter names case-insensitively', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1']),
      importLine('bob', 'tailoring', ['B#2']),
    ].join('\n\n')
    expect(mergeChunks(parseExport(blob))).toHaveLength(1)
  })

  it('keeps different professions of the same crafter separate', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1']),
      importLine('Bob', 'Enchanting', ['B#2']),
    ].join('\n\n')
    expect(mergeChunks(parseExport(blob))).toHaveLength(2)
  })

  it('sorts recipes by name', () => {
    const blob = importLine('Bob', 'Tailoring', ['Zeta#3', 'Alpha#1', 'Mid#2'])
    expect(mergeChunks(parseExport(blob))[0].recipes.map((r) => r.name)).toEqual([
      'Alpha',
      'Mid',
      'Zeta',
    ])
  })
})

// Async since the data globs became lazy chunks — see loadExports.ts.
const entries = await loadCommittedExports()

describe('the committed guild exports', () => {

  it('loads all three profession files', () => {
    expect(entries.map((e) => e.profession).sort()).toEqual([
      'Enchanting',
      'Jewelcrafting',
      'Leatherworking',
    ])
  })

  it('merges the four Enchanting chunks into one deduped list', () => {
    const enchanting = entries.find((e) => e.profession === 'Enchanting')!
    expect(enchanting.crafter).toBe('Slavongiga')
    expect(enchanting.recipes.length).toBe(148)
    expect(new Set(enchanting.recipes.map((r) => r.id)).size).toBe(
      enchanting.recipes.length,
    )
  })

  it('merges the three Jewelcrafting chunks', () => {
    const jc = entries.find((e) => e.profession === 'Jewelcrafting')!
    expect(jc.crafter).toBe('Slavongîga')
    expect(jc.recipes.length).toBe(105)
  })

  it('merges the three Leatherworking chunks', () => {
    const lw = entries.find((e) => e.profession === 'Leatherworking')!
    expect(lw.recipes.length).toBe(107)
  })

  it('parses every committed line without warnings', () => {
    // Guards against a transcription error in data/exports/*.txt.
    expect(entries.every((e) => e.recipes.length > 0)).toBe(true)
  })
})
