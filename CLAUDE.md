# WoW Guild Recipe Registry

A client-side web app that answers **"who in the guild can craft X?"** Guild members
export their profession lists with an in-game addon; those exports are folded into one
committed registry (`recipes.json`) that the app indexes into a searchable table.

No backend, no database, no API keys. The recipe database is a single committed JSON
file.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run import` | Fold `data/exports/*.txt` into `recipes.json`, then empty the folder |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Typecheck (`tsc -b`) then production build to `dist/` |
| `npm run typecheck` | Types only |

## The export format

Data comes from the [Profession Bot Exporter](https://www.curseforge.com/wow/addons/profession-bot-exporter)
addon. It emits chat lines of the form:

```
!profession import <base64>
```

Decoded, each payload is:

```
Slavongiga|Enchanting|
Enchant Weapon - Sunfire#27981
Enchant Gloves - Major Spellpower#33997
```

- Line 1 is the header: `Crafter|Profession|` (trailing pipe is present).
- Every later line is `Recipe Name#ID`, where the ID is a **spell ID for Enchanting
  and an item ID for every other profession** — see "Wowhead links and tooltips".

**Three things about this format that the parser exists to handle:**

1. **Chunking.** WoW's chat length limit forces the addon to split long lists across
   several messages. Each chunk repeats the same header. A 148-recipe Enchanting list
   arrives as four separate `!profession import` lines that must be unioned.
2. **Unpadded base64.** The addon strips `=` padding. `decodePayload` re-pads before
   decoding.
3. **Multibyte names.** Character names contain non-ASCII (e.g. `Slavongîga`), so
   decoding goes through `TextDecoder('utf-8')`, not a byte-per-char shortcut.

## The registry JSON format — the single source of truth

`recipes.json` is the master database and the **only** source the app reads at
runtime. It is a guild-wide registry keyed by spell/item ID — the **inverse** of the
addon format (recipe→crafters rather than crafter→recipes):

```json
{ "22835": { "name": "Elixir of Major Shadow Power",
             "profession": "Alchemy",
             "crafters": ["Bulletdog", "Zoremet"] } }
```

`registryToChunks` transposes it back into per-crafter chunks so it flows through the
same `mergeChunks` path the parser produces. It is picked up from the repo root or
`data/`.

It currently holds **1131 recipes across 25 crafters and 7 professions**. That count
is load-bearing: `loadExports.test.ts` asserts it and will fail loudly if a change
starts dropping data.

### Addon exports are a staging area, not a runtime source

`data/exports/*.txt` is where you drop raw addon exports before folding them in. It is
**consumed at build/tooling time by `npm run import`, never read by the browser.** The
folder is normally empty (only a `README.md` keeps it in git); a `.txt` file is
transient — it exists only between "paste it here" and "run the import".

`npm run import` (→ `scripts/import-exports.ts`) parses every `.txt`, folds anything
new into `recipes.json` via `consolidate()`, then **deletes the `.txt` files**. The
addon dumps a character's *entire* recipe book each time, so most lines already exist;
`consolidate` adds only:

- **new recipe IDs** the registry has never seen, and
- **new crafters** for an ID that is already present.

Everything else is skipped as a duplicate. The merge is idempotent — running import
twice on the same data is a no-op — so a re-export of a mostly-known book only adds its
handful of genuinely new recipes.

## Architecture

```
recipes.json             Master registry — the single runtime source (root or data/)
data/exports/*.txt       Staging area for raw addon exports; emptied by `npm run import`
scripts/
  import-exports.ts      CLI: parse exports → consolidate into recipes.json → clear folder
src/
  types.ts               Recipe, CrafterProfession, ParsedChunk, RecipeMatch
  parser/
    decode.ts            Extract base64 payloads from pasted text; decode to UTF-8
    parse.ts             Decoded text → { crafter, profession, recipes, warnings }
    merge.ts             Union chunks by (crafter, profession); dedupe by spell ID
  data/
    jsonRegistry.ts      recipes.json → ParsedChunk[] (transposes the index)
    consolidate.ts       Fold parsed exports into a registry; add only what's new
    loadExports.ts       Globs recipes.json; loadAllEntries() merges it
  search.ts              buildIndex (recipe → crafters), searchRecipes, wowheadUrl
  components/            Filters, RecipeTable
  App.tsx                State, filtering
```

`scripts/import-exports.ts` runs under **vite-node** (`npm run import`) so it can
import the app's TypeScript parser directly; it is intentionally outside the `tsc -b`
project (`tsconfig.json` includes only `src`), so it never blocks the app build.

### Parser rules (do not regress these)

- **Never throws on bad input.** Malformed lines go into `warnings[]`; the other 147
  recipes in that export still load. One typo must not cost a member their whole list.
- **Splits on the _last_ `#`**, so a recipe named `Recipe #1 Special#12345` parses
  correctly.
- `decodePayload` returns `null` rather than throwing — `extractPayloads` is
  deliberately permissive, so non-payload text does reach it.
- Merging is **case-insensitive** on crafter and profession, but **accent-sensitive**.
  See "Known data quirk" below.

## Adding a guild member's export

1. Have them run the addon and copy every `!profession import` line it produces.
2. Create `data/exports/<crafter>-<profession>.txt` and paste all chunks into it, one
   per line. Optional `#` comment lines at the top are ignored by the parser. The file
   name is cosmetic — crafter and profession come from the header *inside* each
   payload, so a typo'd filename or the wrong case still imports correctly.
3. `npm run import` — folds the new recipes into `recipes.json`, prints a summary of
   what was added vs. already known, and deletes the `.txt` files it consumed.
4. `npm test`, then commit the changed `recipes.json`. Committing the JSON is what
   makes the data permanent and shared; the `.txt` is disposable staging.

Because re-importing is idempotent, it is safe to drop a member's *entire* fresh export
in each time — only their genuinely new recipes land in the registry. When the registry
count legitimately grows, update the assertion in `loadExports.test.ts` to match.

## Armory links

Crafter names link to their Classic Armory profile via `armoryUrl()` in
`src/armory.ts`:

```
https://classic-armory.org/character/<region>/<version>/<realm>/<Name>
```

Region, version and realm are module constants (`eu` / `tbc-anniversary` /
`spineshatter`) because the whole guild is on one realm; only the name varies. Change
those three constants if the guild moves or the app is reused elsewhere — nothing is
hardcoded per character.

Names are percent-encoded (`Slavongîga` → `Slavong%C3%AEga`) and used with the exact
casing stored in the data.

## Known data quirk

The Enchanting export is under **`Slavongiga`**; Jewelcrafting and Leatherworking are
under **`Slavongîga`** (circumflex î). These are treated as **two different crafters**,
because the parser cannot know whether that is one character whose name was
transliterated or two genuinely distinct alts.

Search folds accents, so typing `slavongiga` finds both. If they are meant to be one
character, normalize the header inside the export files rather than adding
accent-folding to `merge.ts` — the merge key should stay faithful to the source data.

## Wowhead links and tooltips

### The ID after `#` is NOT always a spell ID

This is the subtlest thing in the codebase. The addon exports:

- **Enchanting → spell IDs.** Enchants produce no item, so there is nothing else to
  reference. This includes Enchanting's item-like recipes (rods, oils, wands,
  Prismatic Spheres) — they are *all* spell IDs.
- **Every other profession → item IDs**, pointing at the item produced.

Getting this wrong fails **silently and plausibly**, which is why it went unnoticed at
first: both IDs usually exist, they just name different things.

| ID | As `item=` | As `spell=` |
|---|---|---|
| 35945 | Brilliant Glass ✅ | Incendiary Shot ❌ |
| 25686 | Fel Leather Boots ✅ | Super Snowball ❌ |

`wowheadKind()` in `src/search.ts` encodes the rule. It was validated by querying
Wowhead's TBC tooltip API (`nether.wowhead.com/tbc/tooltip/{item,spell}/<id>`) for
**all 1131 committed recipes — every one resolves**, including Engineering, which
follows the item-ID rule like every non-Enchanting profession. If you add a profession that
breaks the pattern, that is where to fix it.

The `Recipe.id` field is deliberately named `id`, not `spellId`, for this reason.

Alchemy `Transmute: X` recipes resolve as items to the *product* (`Transmute: Skyfire
Diamond` → `Skyfire Diamond`), which is the more useful tooltip. That is intended.

### Tooltips

`index.html` loads Wowhead's `power.js`, which attaches hover tooltips to any link
pointing at wowhead.com and reads the TBC branch from the `/tbc/` path in our hrefs.

- `renameLinks` is **off** — recipe names come from the registry (originally the addon
  export) and stay authoritative.
- `colorLinks` and `iconizeLinks` are on. The CSS puts the fallback colour on the
  `td` and sets `a { color: inherit }` so Wowhead's injected `.q1`–`.q5` quality
  classes win when the script loads, and links stay readable gold when it does not.
- Because this is a SPA, `useWowheadTooltips()` calls `$WowheadPower.refreshLinks()`
  whenever the visible rows change. Without it, only the rows present on first paint
  get tooltips. It no-ops when the script is missing (ad blocker, offline, jsdom).

Change `WOWHEAD_BASE` in `src/search.ts` for a different expansion — `/wotlk/`,
`/classic/`, or `https://www.wowhead.com/` for retail.

## Nothing renders until you narrow the list

`App` holds the table behind a `visible` gate: **2+ characters of search text, OR a
profession, OR a crafter** (a one-letter query is deliberately not enough). Until then
it shows a prompt plus a "Show all N recipes" button — browsing is still possible, just
opt-in.

This is not cosmetic. Rendering all 1131 recipes means roughly **3400 anchors**, and
`refreshLinks()` then has power.js resolve every one of them — with `iconizeLinks` on,
that is an icon request per link, on every visit, most of them for rows nobody looked
at.

Two consequences to know before changing it:

- The profession and crafter dropdowns reveal the table **on their own**. Gating on the
  search box alone would make picking "Alchemy" show nothing, which reads as a bug.
- `refreshLinks()` is no longer called on first paint, because there is no table to
  scan. `App.test.tsx` asserts this — that assertion *is* the saving, so a failure
  there means the gate has regressed, not that the test is wrong.

## Testing

72 tests across 9 files. The suite deliberately mixes synthetic fixtures with **real
addon payloads** (`src/test/fixtures.ts`) so encoding regressions surface immediately.

- `parser/*.test.ts` cover decode/parse/merge against synthetic fixtures and real
  payloads.
- `data/consolidate.test.ts` covers the fold-in rules: new IDs added, existing IDs
  credited to a new crafter, re-exports skipped, input registry never mutated,
  case-insensitive/accent-sensitive crafter matching.
- `data/loadExports.test.ts` asserts the committed `recipes.json` loads to **1131
  distinct recipes across 25 crafters and 7 professions**. That count is the guard
  against a bad `npm run import` (truncated paste, lossy merge).

The count is load-bearing. When you legitimately grow the registry via `npm run
import`, update the assertion in `loadExports.test.ts` to match.

## Gotchas

- `vitest` and `vite` major versions must stay compatible. Vitest 2 pins Vite 5; with
  Vite 6 installed npm nests a second copy and `vite.config.ts` fails to typecheck with
  a confusing `Plugin<any> is not assignable to PluginOption` error. The fix is aligning
  versions, not casting.
- `vite.config.ts` imports `defineConfig` from **`vitest/config`**, not `vite`, so the
  `test` key typechecks.
- The `import.meta.glob` for `recipes.json` in `loadExports.ts` is deliberately **not**
  `eager`. Eager inlines the recipe data into the main bundle; lazy splits it into its
  own chunk fetched after first paint (`recipes-*.js`, ~15 kB gzip), keeping the initial
  bundle to the shell. This is why the loader is async — make it sync and you undo the
  split.
- That glob uses absolute paths (`/recipes.json`, `/data/*.json`) so it resolves from
  the repo root, not relative to `src/`.
- `scripts/import-exports.ts` runs under **vite-node**, not plain `node`, because it
  imports the app's extensionless-import TypeScript (`../src/parser`). Node's native
  loader can't resolve those; vite-node reuses Vite's resolver. It is invoked by path
  (`node node_modules/vite-node/vite-node.mjs …`) since npm doesn't symlink a bin for a
  transitive dep — `vite-node` is listed as a direct devDependency to pin it.
