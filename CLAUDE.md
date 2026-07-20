# WoW Guild Recipe Registry

A client-side web app that answers **"who in the guild can craft X?"** Guild members
export their profession lists with an in-game addon; this app decodes, merges, and
indexes those exports into one searchable table.

No backend, no database, no API keys. Recipe data lives as committed text files.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
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

## The registry JSON format

`recipes.json` is a second, independent data source — a guild-wide registry keyed by
spell ID, which is the **inverse** of the addon format (recipe→crafters rather than
crafter→recipes):

```json
{ "22835": { "name": "Elixir of Major Shadow Power",
             "profession": "Alchemy",
             "crafters": ["Bulletdog", "Zoremet"] } }
```

`registryToChunks` transposes it back into per-crafter chunks so both sources flow
through the same `mergeChunks` path. It is picked up from the repo root or `data/`.

### The two sources overlap but neither contains the other

This is the single most important fact about the data. Do **not** "simplify" by
dropping one source:

- `recipes.json` holds 1118 recipes across 24 crafters and 7 professions.
- The addon exports hold 360, of which **352 overlap**.
- **8 spell IDs exist only in the addon exports** (e.g. `Crown of the Sea Witch`
  #32776, `Fel Leather Boots` #25686) — the registry does not know them at all.
- A further **27** are in the registry but not credited to Slavongîga there.

`loadAllEntries()` unions both; `mergeChunks` dedupes by spell ID, so the union is
lossless and idempotent. Total after union: **1126 distinct recipes**.
`loadExports.test.ts` asserts all of this and will fail loudly if a future change
starts dropping data.

## Architecture

```
data/exports/*.txt       Addon exports — one file per character+profession
recipes.json             Guild-wide registry (root or data/; both are globbed)
src/
  types.ts               Recipe, CrafterProfession, ParsedChunk, RecipeMatch
  parser/
    decode.ts            Extract base64 payloads from pasted text; decode to UTF-8
    parse.ts             Decoded text → { crafter, profession, recipes, warnings }
    merge.ts             Union chunks by (crafter, profession); dedupe by spell ID
  data/
    jsonRegistry.ts      recipes.json → ParsedChunk[] (transposes the index)
    loadExports.ts       Globs both sources; loadAllEntries() unions them
  search.ts              buildIndex (recipe → crafters), searchRecipes, wowheadUrl
  components/            Filters, RecipeTable, ImportPanel
  App.tsx                State, filtering, session imports
```

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
2. Create `data/exports/<crafter>-<profession>.txt`. Optional `#` comment lines at the
   top are ignored by the parser.
3. Paste all chunks into that file, one per line.
4. `npm test` — `merge.test.ts` asserts against the committed data and will catch a
   truncated or corrupted paste.

The in-app **Import an export** panel does the same thing without a rebuild: paste,
Parse, then "Download for commit" to get a file to drop into `data/exports/`. Session
imports are in-memory only and vanish on refresh — committing the file is what makes
data permanent and shared.

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
**all 1126 committed recipes — every one resolves.** If you add a profession that
breaks the pattern, that is where to fix it.

The `Recipe.id` field is deliberately named `id`, not `spellId`, for this reason.

Alchemy `Transmute: X` recipes resolve as items to the *product* (`Transmute: Skyfire
Diamond` → `Skyfire Diamond`), which is the more useful tooltip. That is intended.

### Tooltips

`index.html` loads Wowhead's `power.js`, which attaches hover tooltips to any link
pointing at wowhead.com and reads the TBC branch from the `/tbc/` path in our hrefs.

- `renameLinks` is **off** — recipe names come from the addon export and stay
  authoritative.
- `colorLinks` and `iconizeLinks` are on. The CSS puts the fallback colour on the
  `td` and sets `a { color: inherit }` so Wowhead's injected `.q1`–`.q5` quality
  classes win when the script loads, and links stay readable gold when it does not.
- Because this is a SPA, `useWowheadTooltips()` calls `$WowheadPower.refreshLinks()`
  whenever the visible rows change. Without it, only the rows present on first paint
  get tooltips. It no-ops when the script is missing (ad blocker, offline, jsdom).

Change `WOWHEAD_BASE` in `src/search.ts` for a different expansion — `/wotlk/`,
`/classic/`, or `https://www.wowhead.com/` for retail.

## Testing

73 tests across 8 files. The suite deliberately mixes synthetic fixtures with **real
addon payloads** (`src/test/fixtures.ts`) so encoding regressions surface immediately.

`merge.test.ts` asserts exact recipe counts against the committed exports:

| File | Chunks | Recipes |
|---|---|---|
| `slavongiga-enchanting.txt` | 4 | 148 |
| `slavongiga-jewelcrafting.txt` | 3 | 105 |
| `slavongiga-leatherworking.txt` | 3 | 107 |
| `recipes.json` | — | 1118 (24 crafters) |
| **union** | | **1126** |

Those numbers are load-bearing — they are what catches a bad paste or a lossy merge.
When you add or update a data file, update the counts in `merge.test.ts` and
`loadExports.test.ts` to match.

## Gotchas

- `vitest` and `vite` major versions must stay compatible. Vitest 2 pins Vite 5; with
  Vite 6 installed npm nests a second copy and `vite.config.ts` fails to typecheck with
  a confusing `Plugin<any> is not assignable to PluginOption` error. The fix is aligning
  versions, not casting.
- `vite.config.ts` imports `defineConfig` from **`vitest/config`**, not `vite`, so the
  `test` key typechecks.
- `import.meta.glob` in `loadExports.ts` uses an absolute path (`/data/exports/*.txt`)
  because the data directory sits outside `src/`.
