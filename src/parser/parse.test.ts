import { describe, expect, it } from 'vitest'
import { parseChunkText, parseExport } from './parse'
import { importLine, REAL_ENCHANTING_CHUNK_1, REAL_JEWELCRAFTING_CHUNK } from '../test/fixtures'

describe('parseChunkText', () => {
  it('reads the crafter and profession from the header', () => {
    const chunk = parseChunkText('Slavongiga|Enchanting|\nEnchant Weapon - Sunfire#27981')
    expect(chunk).toMatchObject({ crafter: 'Slavongiga', profession: 'Enchanting' })
    expect(chunk!.recipes).toEqual([{ name: 'Enchant Weapon - Sunfire', id: 27981 }])
  })

  it('splits on the last # so recipe names containing # survive', () => {
    const chunk = parseChunkText('Bob|Tailoring|\nRecipe #1 Special#12345')
    expect(chunk!.recipes).toEqual([{ name: 'Recipe #1 Special', id: 12345 }])
  })

  it('keeps apostrophes and hyphens in names intact', () => {
    const chunk = parseChunkText("Bob|Leatherworking|\nHillman's Cloak#3719\nStylin' Jungle Hat#25682")
    expect(chunk!.recipes.map((r) => r.name)).toEqual(["Hillman's Cloak", "Stylin' Jungle Hat"])
  })

  it('skips blank lines without warning', () => {
    const chunk = parseChunkText('Bob|Tailoring|\n\nA#1\n\n\nB#2\n')
    expect(chunk!.recipes).toHaveLength(2)
    expect(chunk!.warnings).toEqual([])
  })

  it('collects malformed lines as warnings rather than throwing', () => {
    const chunk = parseChunkText('Bob|Tailoring|\nGood#1\nno hash here\nBad#notanumber\n#9')
    expect(chunk!.recipes).toEqual([{ name: 'Good', id: 1 }])
    expect(chunk!.warnings).toEqual(['no hash here', 'Bad#notanumber', '#9'])
  })

  it('returns null when the header is missing a profession', () => {
    expect(parseChunkText('Bob|\nA#1')).toBeNull()
    expect(parseChunkText('')).toBeNull()
  })
})

describe('parseExport', () => {
  it('parses a real Enchanting chunk end to end', () => {
    const [chunk] = parseExport(REAL_ENCHANTING_CHUNK_1)
    expect(chunk.crafter).toBe('Slavongiga')
    expect(chunk.profession).toBe('Enchanting')
    expect(chunk.recipes).toContainEqual({ name: 'Enchant Weapon - Sunfire', id: 27981 })
    expect(chunk.warnings).toEqual([])
  })

  it('parses a real chunk with an accented crafter name', () => {
    const [chunk] = parseExport(REAL_JEWELCRAFTING_CHUNK)
    expect(chunk.crafter).toBe('Slavongîga')
    expect(chunk.profession).toBe('Jewelcrafting')
    expect(chunk.recipes).toContainEqual({ name: 'Brilliant Glass', id: 35945 })
  })

  it('parses several chunks pasted together', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1']),
      importLine('Bob', 'Tailoring', ['B#2']),
    ].join('\n\n')
    expect(parseExport(blob)).toHaveLength(2)
  })

  it('returns an empty array for text with no payload', () => {
    expect(parseExport('just some chat text')).toEqual([])
  })
})
