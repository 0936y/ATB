import { describe, expect, it } from 'vitest'
import { armoryUrl, ARMORY_BASE } from './armory'

describe('armoryUrl', () => {
  it('builds the documented URL for a plain name', () => {
    expect(armoryUrl('SlavonGiga')).toBe(
      'https://classic-armory.org/character/eu/tbc-anniversary/spineshatter/SlavonGiga',
    )
  })

  it('derives every character from the same template', () => {
    for (const name of ['Gorzbalxua', 'Royarni', 'Benteha']) {
      expect(armoryUrl(name)).toBe(`${ARMORY_BASE}/${name}`)
    }
  })

  it('preserves the name casing as stored', () => {
    expect(armoryUrl('Slavongiga')).toMatch(/\/Slavongiga$/)
  })

  it('percent-encodes non-ASCII names', () => {
    expect(armoryUrl('Slavongîga')).toBe(`${ARMORY_BASE}/Slavong%C3%AEga`)
  })

  it('trims stray whitespace', () => {
    expect(armoryUrl('  Royarni  ')).toBe(`${ARMORY_BASE}/Royarni`)
  })
})
