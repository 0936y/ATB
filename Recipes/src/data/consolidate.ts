import type { CrafterProfession } from '../types'
import type { JsonRegistry } from './jsonRegistry'

/**
 * Folding addon exports into the master `recipes.json`.
 *
 * The registry (`recipes.json`) is the single source of truth the app reads.
 * Addon exports in `data/exports/` are a staging area: the import script parses
 * them, folds anything new into the registry with `consolidate`, then empties
 * the folder. Because the addon dumps a character's ENTIRE recipe book every
 * time, most lines in a fresh export already exist — those are skipped. Only
 * genuinely new recipe IDs, and new crafters for an existing ID, are added.
 */

export interface ConsolidateSummary {
  /** IDs the registry had never seen before. */
  newRecipes: Array<{ id: number; name: string; profession: string; crafter: string }>
  /** Existing IDs newly credited to another crafter. */
  newCredits: Array<{ id: number; name: string; crafter: string }>
  /** (crafter, recipe) pairs already present — the bulk of a re-export. */
  duplicates: number
}

export interface ConsolidateResult {
  registry: JsonRegistry
  summary: ConsolidateSummary
}

/** Same identity rule the merge uses: case-insensitive, accent-sensitive. */
function sameCrafter(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Return a NEW registry that is `base` plus everything in `entries` that it did
 * not already contain. `base` is never mutated, so callers can diff old vs new.
 *
 * Names and professions are taken from the existing registry entry when the ID
 * is already known (the registry stays authoritative); a brand-new ID adopts the
 * name and profession from the export that introduced it.
 */
export function consolidate(
  base: JsonRegistry,
  entries: CrafterProfession[],
): ConsolidateResult {
  const registry: JsonRegistry = {}
  for (const [id, entry] of Object.entries(base)) {
    registry[id] = {
      name: entry.name,
      profession: entry.profession,
      crafters: [...entry.crafters],
    }
  }

  const summary: ConsolidateSummary = { newRecipes: [], newCredits: [], duplicates: 0 }

  for (const entry of entries) {
    for (const recipe of entry.recipes) {
      const id = String(recipe.id)
      const existing = registry[id]

      if (!existing) {
        registry[id] = {
          name: recipe.name,
          profession: entry.profession,
          crafters: [entry.crafter],
        }
        summary.newRecipes.push({
          id: recipe.id,
          name: recipe.name,
          profession: entry.profession,
          crafter: entry.crafter,
        })
        continue
      }

      if (existing.crafters.some((c) => sameCrafter(c, entry.crafter))) {
        summary.duplicates++
        continue
      }

      existing.crafters.push(entry.crafter)
      summary.newCredits.push({ id: recipe.id, name: existing.name, crafter: entry.crafter })
    }
  }

  return { registry, summary }
}

/**
 * Serialize a registry the way `recipes.json` is stored on disk: keys in numeric
 * order, two-space indent, trailing newline. Keeping the shape stable means a
 * consolidation produces a minimal, reviewable git diff.
 */
export function serializeRegistry(registry: JsonRegistry): string {
  const ordered: JsonRegistry = {}
  for (const id of Object.keys(registry).sort((a, b) => Number(a) - Number(b))) {
    ordered[id] = registry[id]
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

/**
 * Detects a staged export with NO recognizable `!profession import <base64>`
 * payload at all — as distinct from a recognized payload that happened to add
 * nothing new (a legitimate re-export of an already-known recipe book, which
 * must stay a silent success). `fileCount` is how many `.txt` files were
 * staged; `chunkCount` is how many `ParsedChunk`s `parseExport` extracted from
 * all of them combined. Zero chunks from a non-empty file set means the file(s)
 * were unparseable garbage — e.g. missing the `!profession import` envelope
 * entirely — not just fully-duplicate data.
 */
export function hasUnrecognizedExport(fileCount: number, chunkCount: number): boolean {
  return fileCount > 0 && chunkCount === 0
}

export interface RegistryStats {
  /** Distinct recipe IDs — one per valid registry key. */
  recipes: number
  /** Distinct crafters, counted case-insensitively (as the app treats them). */
  crafters: number
}

/**
 * Count what `loadExports.test.ts` asserts on: distinct recipe IDs and distinct
 * crafters. Crafters are folded to lower case to match how the loader/merge key
 * them — `Slavongiga` and `slavongiga` are one person, `Slavongîga` is another.
 */
export function registryStats(registry: JsonRegistry): RegistryStats {
  const crafters = new Set<string>()
  let recipes = 0
  for (const [id, entry] of Object.entries(registry)) {
    if (!/^\d+$/.test(id)) continue
    recipes++
    for (const c of entry.crafters) if (c.trim()) crafters.add(c.toLowerCase())
  }
  return { recipes, crafters: crafters.size }
}

/**
 * Render the `registry.stats.ts` snapshot module. The import script rewrites this
 * after every successful import so the test's expected counts track the data
 * automatically — no hand-editing. Because only `npm run import` regenerates it,
 * a later lossy hand-edit to `recipes.json` still fails the test loudly.
 */
export function serializeStats(stats: RegistryStats): string {
  return (
    '// AUTO-GENERATED by `npm run import` (scripts/import-exports.ts).\n' +
    "// A committed snapshot of recipes.json's size; loadExports.test.ts asserts the\n" +
    '// loaded registry still matches it, so a lossy edit to recipes.json fails loudly.\n' +
    '// Do not edit by hand — it is rewritten after every successful import.\n' +
    `export const REGISTRY_STATS = { recipes: ${stats.recipes}, crafters: ${stats.crafters} } as const\n`
  )
}
