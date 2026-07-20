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
  eager: true,
}) as Record<string, string>

/**
 * Guild-wide registry JSON. Accepted at the repo root or in `data/`, since the
 * exporting tool drops it in either place.
 */
const jsonRegistries = import.meta.glob(['/recipes.json', '/data/*.json'], {
  import: 'default',
  eager: true,
}) as Record<string, JsonRegistry>

export function loadExportChunks(): ParsedChunk[] {
  return Object.values(rawExports).flatMap((raw) => parseExport(raw))
}

export function loadRegistryChunks(): ParsedChunk[] {
  return Object.values(jsonRegistries).flatMap((registry) => registryToChunks(registry))
}

/** Addon exports only — used by tests that assert on the committed .txt files. */
export function loadCommittedExports(): CrafterProfession[] {
  return mergeChunks(loadExportChunks())
}

/**
 * Every source, unioned.
 *
 * The two sources overlap heavily but neither contains the other: the addon
 * exports carry recipes the registry lacks, and vice versa. `mergeChunks`
 * dedupes by spell ID per (crafter, profession), so unioning is safe and
 * loses nothing.
 */
export function loadAllEntries(): CrafterProfession[] {
  return mergeChunks([...loadExportChunks(), ...loadRegistryChunks()])
}
