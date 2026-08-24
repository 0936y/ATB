import { describe, expect, it } from 'vitest'
import { mergeChunks } from './merge'
import { parseExport } from './parse'
import { importLine } from '../test/fixtures'

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
