import { describe, expect, it } from 'vitest'
import { decodePayload, extractPayloads } from './decode'
import { encodeChunk, importLine, REAL_ENCHANTING_CHUNK_1 } from '../test/fixtures'

describe('extractPayloads', () => {
  it('pulls the payload out of an !profession import line', () => {
    const line = importLine('Bob', 'Tailoring', ['Bolt of Linen#2963'])
    expect(extractPayloads(line)).toHaveLength(1)
  })

  it('finds every chunk in a multi-chunk blob', () => {
    const blob = [
      importLine('Bob', 'Tailoring', ['A#1']),
      importLine('Bob', 'Tailoring', ['B#2']),
      importLine('Bob', 'Tailoring', ['C#3']),
    ].join('\n\n')
    expect(extractPayloads(blob)).toHaveLength(3)
  })

  it('accepts a bare payload with no import prefix', () => {
    const payload = encodeChunk('Bob', 'Tailoring', ['Bolt of Linen#2963'])
    expect(extractPayloads(payload)).toEqual([payload])
  })

  it('ignores surrounding prose such as the Crafter/Tradeskill labels', () => {
    const blob = `Crafter: Bob\nTradeskill: Tailoring\n\n${importLine('Bob', 'Tailoring', ['A#1'])}`
    expect(extractPayloads(blob)).toHaveLength(1)
  })
})

describe('decodePayload', () => {
  it('decodes a real unpadded addon payload', () => {
    const [payload] = extractPayloads(REAL_ENCHANTING_CHUNK_1)
    const text = decodePayload(payload)
    expect(text).not.toBeNull()
    expect(text!.split('\n')[0]).toBe('Slavongiga|Enchanting|')
    expect(text).toContain('Enchant Weapon - Sunfire#27981')
  })

  it('re-pads base64 whose length is not a multiple of four', () => {
    const unpadded = encodeChunk('Bob', 'Tailoring', ['A#1']).replace(/=+$/, '')
    expect(decodePayload(unpadded)).toContain('Bob|Tailoring|')
  })

  it('preserves multibyte UTF-8 in crafter names', () => {
    const payload = encodeChunk('Slavongîga', 'Jewelcrafting', ['Brilliant Glass#35945'])
    expect(decodePayload(payload)).toContain('Slavongîga|Jewelcrafting|')
  })

  it('returns null for a non-base64 payload instead of throwing', () => {
    expect(decodePayload('!!!!not base64!!!!')).toBeNull()
  })

  it('returns null for an empty payload', () => {
    expect(decodePayload('')).toBeNull()
  })
})
