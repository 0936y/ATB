import type { CrafterProfession, ParsedChunk } from '../types'

/** Case-insensitive key so `slavongiga` and `Slavongiga` are one character. */
function key(crafter: string, profession: string): string {
  return `${crafter.toLowerCase()}|${profession.toLowerCase()}`
}

/**
 * Merge chunks into one entry per (crafter, profession).
 *
 * The addon repeats the header in every chunk, so a 150-recipe Enchanting list
 * arrives as four chunks that must be unioned. Recipes are deduped by spell ID
 * and returned sorted by name.
 */
export function mergeChunks(chunks: ParsedChunk[]): CrafterProfession[] {
  const merged = new Map<string, { crafter: string; profession: string; byId: Map<number, string> }>()

  for (const chunk of chunks) {
    const k = key(chunk.crafter, chunk.profession)
    let entry = merged.get(k)
    if (!entry) {
      entry = { crafter: chunk.crafter, profession: chunk.profession, byId: new Map() }
      merged.set(k, entry)
    }
    for (const recipe of chunk.recipes) {
      entry.byId.set(recipe.id, recipe.name)
    }
  }

  return [...merged.values()]
    .map((entry) => ({
      crafter: entry.crafter,
      profession: entry.profession,
      recipes: [...entry.byId.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.crafter.localeCompare(b.crafter) || a.profession.localeCompare(b.profession))
}
