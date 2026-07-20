import type { ParsedChunk } from '../types'

/**
 * Shape of a guild-wide registry JSON, keyed by spell ID:
 *
 *   { "22835": { name, profession, crafters: [...] }, ... }
 *
 * This is already an index (recipe → crafters), the inverse of the addon export
 * format (crafter → recipes), so it is transposed back into per-crafter chunks
 * and fed through the same merge path.
 */
export interface JsonRegistryEntry {
  name: string
  profession: string
  crafters: string[]
}

export type JsonRegistry = Record<string, JsonRegistryEntry>

function isValidEntry(value: unknown): value is JsonRegistryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<JsonRegistryEntry>
  return (
    typeof entry.name === 'string' &&
    typeof entry.profession === 'string' &&
    Array.isArray(entry.crafters) &&
    entry.crafters.every((c) => typeof c === 'string')
  )
}

/**
 * Transpose a registry into one chunk per (crafter, profession).
 *
 * Malformed entries are collected into the first chunk's `warnings` rather than
 * throwing, matching the addon parser's contract.
 */
export function registryToChunks(registry: JsonRegistry): ParsedChunk[] {
  const byCrafter = new Map<string, ParsedChunk>()
  const warnings: string[] = []

  for (const [idText, entry] of Object.entries(registry)) {
    if (!/^\d+$/.test(idText) || !isValidEntry(entry)) {
      warnings.push(idText)
      continue
    }

    const id = Number(idText)
    for (const crafter of entry.crafters) {
      if (!crafter.trim()) continue

      const key = `${crafter.toLowerCase()}|${entry.profession.toLowerCase()}`
      let chunk = byCrafter.get(key)
      if (!chunk) {
        chunk = { crafter, profession: entry.profession, recipes: [], warnings: [] }
        byCrafter.set(key, chunk)
      }
      chunk.recipes.push({ name: entry.name, id })
    }
  }

  const chunks = [...byCrafter.values()]
  if (warnings.length > 0) {
    if (chunks.length > 0) chunks[0].warnings = warnings
    else chunks.push({ crafter: '', profession: '', recipes: [], warnings })
  }
  return chunks
}
