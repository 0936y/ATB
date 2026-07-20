import type { CrafterProfession, ParsedChunk } from '../types'
import { mergeChunks, parseExport } from '../parser'
import { registryToChunks, type JsonRegistry } from './jsonRegistry'

/**
 * Addon exports (`!profession import …`), one file per character+profession.
 * Drop a new `.txt` into `data/exports/` and it appears here automatically.
 */
const rawExports = import.meta.glob('/data/exports/*.txt', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/**
 * Guild-wide registry JSON. Accepted at the repo root or in `data/`, since the
 * exporting tool drops it in either place.
 */
const jsonRegistries = import.meta.glob(['/recipes.json', '/data/*.json'], {
  import: 'default',
}) as Record<string, () => Promise<JsonRegistry>>

/**
 * The globs are deliberately NOT `eager` — that would inline every export and
 * `recipes.json` into the main bundle, so a visitor downloads ~190 kB of recipe
 * data before the page can paint. Non-eager, Vite emits them as a separate chunk
 * the app fetches after first paint (see `App`), keeping the initial load to the
 * shell. The trade-off is that every loader here is async.
 */
async function loadAll<T>(glob: Record<string, () => Promise<T>>): Promise<T[]> {
  return Promise.all(Object.values(glob).map((load) => load()))
}

export async function loadExportChunks(): Promise<ParsedChunk[]> {
  const raws = await loadAll(rawExports)
  return raws.flatMap((raw) => parseExport(raw))
}

export async function loadRegistryChunks(): Promise<ParsedChunk[]> {
  const registries = await loadAll(jsonRegistries)
  return registries.flatMap((registry) => registryToChunks(registry))
}

/** Addon exports only — used by tests that assert on the committed .txt files. */
export async function loadCommittedExports(): Promise<CrafterProfession[]> {
  return mergeChunks(await loadExportChunks())
}

/**
 * Every source, unioned.
 *
 * The two sources overlap heavily but neither contains the other: the addon
 * exports carry recipes the registry lacks, and vice versa. `mergeChunks`
 * dedupes by spell ID per (crafter, profession), so unioning is safe and
 * loses nothing.
 */
export async function loadAllEntries(): Promise<CrafterProfession[]> {
  const [exports, registry] = await Promise.all([loadExportChunks(), loadRegistryChunks()])
  return mergeChunks([...exports, ...registry])
}
