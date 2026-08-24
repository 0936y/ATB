import type { CrafterProfession, ParsedChunk } from '../types'
import { mergeChunks } from '../parser'
import { registryToChunks, type JsonRegistry } from './jsonRegistry'

/**
 * The master guild registry. `recipes.json` is the single source of truth the
 * app reads at runtime — addon exports are folded into it ahead of time by
 * `npm run import` (see `scripts/import-exports.ts`), so there is nothing to
 * parse or union in the browser. Accepted at the repo root or in `data/`.
 */
const jsonRegistries = import.meta.glob(['/Recipes/recipes.json', '/Recipes/data/*.json'], {
  import: 'default',
}) as Record<string, () => Promise<JsonRegistry>>

/**
 * The glob is deliberately NOT `eager` — that would inline `recipes.json` into
 * the main bundle, so a visitor downloads ~190 kB of recipe data before the page
 * can paint. Non-eager, Vite emits it as a separate chunk the app fetches after
 * first paint (see `App`), keeping the initial load to the shell. The trade-off
 * is that the loader is async.
 */
async function loadAll<T>(glob: Record<string, () => Promise<T>>): Promise<T[]> {
  return Promise.all(Object.values(glob).map((load) => load()))
}

export async function loadRegistryChunks(): Promise<ParsedChunk[]> {
  const registries = await loadAll(jsonRegistries)
  return registries.flatMap((registry) => registryToChunks(registry))
}

/**
 * Every crafter/profession the app knows about, merged into one entry each.
 *
 * A single source now (`recipes.json`), so this is just the registry transposed
 * and deduped by spell ID per (crafter, profession).
 */
export async function loadAllEntries(): Promise<CrafterProfession[]> {
  return mergeChunks(await loadRegistryChunks())
}
