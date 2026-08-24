import { describe, expect, it } from 'vitest'
import { ALT_GROUPS, relatedAlts } from './alts'

describe('relatedAlts', () => {
  it('returns the other characters in a roster, in order, excluding the queried one', () => {
    expect(relatedAlts('Slavongiga')).toEqual(['Slavongîga', 'Slavon'])
    expect(relatedAlts('Slavon')).toEqual(['Slavongiga', 'Slavongîga'])
  })

  it('matches case-insensitively', () => {
    expect(relatedAlts('cassyette')).toEqual(['Evonte', 'Enevalake'])
  })

  it('matches accent-sensitively — the two Slavon spellings are distinct names', () => {
    expect(relatedAlts('Slavongîga')).toEqual(['Slavongiga', 'Slavon'])
    expect(relatedAlts('Slavongiga')).not.toContain('Slavongiga')
  })

  it('returns an empty array for a character with no known alts', () => {
    expect(relatedAlts('Nobodyknowsme')).toEqual([])
  })

  it('handles rosters of two', () => {
    expect(relatedAlts('Arnsgar')).toEqual(['Rollø'])
    expect(relatedAlts('Rollø')).toEqual(['Arnsgar'])
  })

  it('has no character appearing in more than one group', () => {
    const seen = new Map<string, number>()
    for (const group of ALT_GROUPS) {
      for (const name of group) {
        const k = name.toLowerCase()
        seen.set(k, (seen.get(k) ?? 0) + 1)
      }
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
    expect(dupes).toEqual([])
  })
})
