/**
 * Fold every addon export in `data/exports/` into the master `recipes.json`,
 * then empty the folder.
 *
 * Run with:  npm run import
 *
 * Workflow: drop the `!profession import …` files a guild member gives you into
 * `data/exports/`, run this, commit the changed `recipes.json`. The addon dumps
 * a character's whole recipe book, so most lines already exist — only new recipe
 * IDs and new crafters for a known ID are added (see `consolidate`). The `.txt`
 * files are deleted afterwards because their data now lives in `recipes.json`;
 * nothing at runtime reads `data/exports/` any more.
 *
 * Runs under vite-node so it can import the app's TypeScript parser directly.
 */
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mergeChunks, parseExport } from '../src/parser'
import {
  consolidate,
  hasUnrecognizedExport,
  registryStats,
  serializeRegistry,
  serializeStats,
} from '../src/data/consolidate'
import type { JsonRegistry } from '../src/data/jsonRegistry'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_PATH = join(ROOT, 'recipes.json')
const STATS_PATH = join(ROOT, 'src', 'data', 'registry.stats.ts')
const EXPORTS_DIR = join(ROOT, 'data', 'exports')

function loadRegistry(): JsonRegistry {
  if (!existsSync(REGISTRY_PATH)) return {}
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as JsonRegistry
}

function main(): void {
  const files = existsSync(EXPORTS_DIR)
    ? readdirSync(EXPORTS_DIR).filter((f) => f.toLowerCase().endsWith('.txt'))
    : []

  if (files.length === 0) {
    console.log('data/exports/ has no .txt files — nothing to import.')
    return
  }

  const chunks = files.flatMap((file) => parseExport(readFileSync(join(EXPORTS_DIR, file), 'utf8')))
  const warnings = chunks.reduce((n, c) => n + c.warnings.length, 0)
  const entries = mergeChunks(chunks)

  // Distinct from "warnings > 0" (malformed lines *within* a recognized payload —
  // see parse.ts). This catches a staged file with NO recognizable
  // `!profession import <base64>` payload at all, which produces zero chunks and
  // zero warnings. Without this check, main() still deletes the .txt and CI
  // commits that deletion as if the import succeeded, even though nothing was
  // ever extracted from it. A legitimate re-export that adds nothing new (every
  // recipe already known) still produces chunks — just no new entries in
  // `summary` below — so it does NOT trip this check. See
  // `hasUnrecognizedExport`'s unit tests in consolidate.test.ts.
  const noPayloadsFound = hasUnrecognizedExport(files.length, chunks.length)

  const before = loadRegistry()
  const beforeIds = Object.keys(before).length
  const { registry, summary } = consolidate(before, entries)

  writeFileSync(REGISTRY_PATH, serializeRegistry(registry))

  // Refresh the committed count snapshot the test asserts on, so the expected
  // number tracks the data automatically instead of being hand-edited.
  const stats = registryStats(registry)
  writeFileSync(STATS_PATH, serializeStats(stats))

  // The export data now lives in recipes.json; clear the staging folder.
  for (const file of files) rmSync(join(EXPORTS_DIR, file))

  const afterIds = Object.keys(registry).length
  console.log(`Imported ${files.length} file(s): ${files.join(', ')}`)
  console.log(
    `  recipes.json: ${beforeIds} → ${afterIds} recipes ` +
      `(+${summary.newRecipes.length} new, +${summary.newCredits.length} crafter credits, ` +
      `${summary.duplicates} already known)`,
  )
  console.log(`  registry.stats.ts: ${stats.recipes} recipes / ${stats.crafters} crafters`)
  if (warnings > 0) console.log(`  ${warnings} unreadable line(s) skipped`)
  for (const r of summary.newRecipes) {
    console.log(`  + recipe ${r.id} ${r.name} (${r.profession}) — ${r.crafter}`)
  }
  for (const c of summary.newCredits) {
    console.log(`  + credit ${c.id} ${c.name} — ${c.crafter}`)
  }
  console.log(`Cleared ${files.length} file(s) from data/exports/.`)

  if (noPayloadsFound) {
    console.error(
      `ERROR: ${files.length} file(s) were staged but none contained a recognizable ` +
        `'!profession import <base64>' payload — 0 chunks were parsed out of them. ` +
        `Nothing was added to recipes.json. This is likely a garbage or malformed ` +
        `upload; the staged file(s) have been cleared, but no commit should be made ` +
        `for this run.`,
    )
    // Not process.exit(1): let the console output above flush before the process
    // exits with a failing code (CI reads exit code; a human reads the log).
    process.exitCode = 1
  }
}

main()
