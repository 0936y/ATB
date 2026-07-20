import type { ParsedChunk, Recipe } from '../types'
import { decodePayload, extractPayloads } from './decode'

/**
 * Parse decoded chunk text of the form:
 *
 *   Slavongiga|Enchanting|
 *   Enchant Weapon - Sunfire#27981
 *   Enchant Gloves - Major Spellpower#33997
 *
 * Malformed lines are collected into `warnings` instead of throwing, so one bad
 * line in a member's export never costs us the other 150 recipes.
 */
export function parseChunkText(text: string): ParsedChunk | null {
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.trim()
  if (!header) return null

  const [crafter, profession] = header.split('|')
  if (!crafter?.trim() || !profession?.trim()) return null

  const recipes: Recipe[] = []
  const warnings: string[] = []

  for (const raw of lines.slice(1)) {
    const line = raw.trim()
    if (!line) continue

    // Split on the LAST '#' so recipe names containing '#' survive intact.
    const hash = line.lastIndexOf('#')
    if (hash <= 0) {
      warnings.push(line)
      continue
    }

    const name = line.slice(0, hash).trim()
    const idText = line.slice(hash + 1).trim()

    if (!name || !/^\d+$/.test(idText)) {
      warnings.push(line)
      continue
    }

    recipes.push({ name, id: Number(idText) })
  }

  return { crafter: crafter.trim(), profession: profession.trim(), recipes, warnings }
}

/**
 * Parse a pasted blob containing one or more `!profession import` chunks.
 * Payloads that fail to decode are skipped silently — `extractPayloads` is
 * deliberately permissive, so non-payload text can reach here.
 */
export function parseExport(input: string): ParsedChunk[] {
  const chunks: ParsedChunk[] = []
  for (const payload of extractPayloads(input)) {
    const text = decodePayload(payload)
    if (text === null) continue

    const chunk = parseChunkText(text)
    if (chunk) chunks.push(chunk)
  }
  return chunks
}
