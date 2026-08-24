# ATB — Spineshatter Guild Web Tools

The repo (`0936y/ATB`, deployed at `https://0936y.github.io/ATB/`) hosts guild web
tools as sibling services under one GitHub Pages site. Today there are two:

- **Recipe Registry** (`/Recipes/`) — answers **"who in the guild can craft X?"** Guild
  members export their profession lists with an in-game addon; those exports are
  folded into one committed registry (`Recipes/recipes.json`) that the app indexes into
  a searchable table.
- **P3 Loot Prio** (`/p3-loot-prio/`) — a searchable copy of a TBC Phase 3 loot
  priority table (see "The P3 loot prio page").

The site root (`/`) is a small landing page with two buttons to the services above —
see "The landing page". No backend, no database, no API keys anywhere.

Each service is a physically separate folder (`Recipes/`, `p3-loot-prio/`) with its own
`index.html` and `src/`, so the repo can keep adding sibling services without their
code getting tangled together. Genuinely cross-service code (Wowhead link helpers,
accent-folding, the header nav, shared CSS, the vitest setup file) lives in
`src/shared/` — see "Architecture". This is a **three-entry Vite MPA**, not a
single-page app.

## Commands

Run from the repo root — there is one `package.json` for the whole site.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run import` | Fold `Recipes/data/exports/*.txt` into `Recipes/recipes.json`, then empty the folder |
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

`Recipes/recipes.json` is the master database and the **only** source the Recipes app
reads at runtime. It is a guild-wide registry keyed by spell/item ID — the **inverse**
of the addon format (recipe→crafters rather than crafter→recipes):

```json
{ "22835": { "name": "Elixir of Major Shadow Power",
             "profession": "Alchemy",
             "crafters": ["Bulletdog", "Zoremet"] } }
```

`registryToChunks` transposes it back into per-crafter chunks so it flows through the
same `mergeChunks` path the parser produces. It is picked up from `Recipes/` or
`Recipes/data/`.

It currently holds **1148 recipes across 25 crafters and 8 professions**. That count
is load-bearing: `loadExports.test.ts` asserts it and will fail loudly if a change
starts dropping data.

### Addon exports are a staging area, not a runtime source

`Recipes/data/exports/*.txt` is where you drop raw addon exports before folding them
in. It is **consumed at build/tooling time by `npm run import`, never read by the
browser.** The folder is normally empty (only a `README.md` keeps it in git); a `.txt`
file is transient — it exists only between "paste it here" and "run the import".

`npm run import` (→ `Recipes/scripts/import-exports.ts`) parses every `.txt`, folds
anything new into `recipes.json` via `consolidate()`, then **deletes the `.txt`
files**. The addon dumps a character's *entire* recipe book each time, so most lines
already exist; `consolidate` adds only:

- **new recipe IDs** the registry has never seen, and
- **new crafters** for an ID that is already present.

Everything else is skipped as a duplicate. The merge is idempotent — running import
twice on the same data is a no-op — so a re-export of a mostly-known book only adds its
handful of genuinely new recipes.

## Architecture

```
index.html                    Landing page entry — the site root, two buttons out
p3-loot-prio/
  index.html                  P3 loot prio entry — its own URL, own Vite chunk
  src/
    p3-loot-prio.json         Committed snapshot of the tbcguides.gg P3 prio table
    types.ts                  LootPrioItem
    lootData.ts               loadLootPrio(), filterLoot(), raidsOf(), bossesOf()
    LootPrio.tsx               State, filtering
    LootPrioTable.tsx          The table itself
    main.tsx                  Page mount point
Recipes/
  index.html                  Recipe registry entry — its own URL, own Vite chunk
  recipes.json                Master registry — the single runtime source (or data/)
  data/exports/*.txt          Staging area for raw addon exports; emptied by `npm run import`
  scripts/
    import-exports.ts         CLI: parse exports → consolidate into recipes.json → clear folder
  src/
    types.ts                  Recipe, CrafterProfession, ParsedChunk, RecipeMatch
    search.ts                 buildIndex (recipe → crafters), searchRecipes, wowheadUrl/wowheadKind
    armory.ts                 armoryUrl() — Classic Armory profile links
    alts.ts                   ALT_GROUPS, relatedAlts() — alt/main roster
    parser/
      decode.ts               Extract base64 payloads from pasted text; decode to UTF-8
      parse.ts                Decoded text → { crafter, profession, recipes, warnings }
      merge.ts                Union chunks by (crafter, profession); dedupe by spell ID
    data/
      jsonRegistry.ts         recipes.json → ParsedChunk[] (transposes the index)
      consolidate.ts          Fold parsed exports into a registry; add only what's new
      registry.stats.ts       AUTO-GENERATED count snapshot ({recipes, crafters}) — see below
      loadExports.ts          Globs recipes.json; loadAllEntries() merges it
    components/                Filters, RecipeTable
    App.tsx                   State, filtering
    main.tsx                  Page mount point
src/
  landing/
    Landing.tsx                The two-button dispatcher — see "The landing page"
    main.tsx                  Landing page mount point
  shared/                     Code both services use — see "Why src/shared/ exists"
    text.ts                   fold() — accent/case folding used by both searches
    wowhead.ts                useWowheadTooltips() — re-scan DOM after a render
    wowheadLinks.ts           WOWHEAD_BASE, wowheadItemUrl() — generic item links
    SiteNav.tsx                Header nav — home + both services, on every page but landing
    styles.css                 Site-wide styles (theme vars, nav, tables, landing page)
    test/setup.ts              Shared vitest setup
```

`Recipes/scripts/import-exports.ts` runs under **vite-node** (`npm run import`) so it
can import the app's TypeScript parser directly; it is intentionally outside the
`tsc -b` project's default `src` folder — `tsconfig.json`'s `include` lists it only via
`Recipes/src`, not the script itself — so it never blocks the app build.

### Why `src/shared/` exists

`Recipes/` and `p3-loot-prio/` are fully separate folders — each can be read, tested,
or reasoned about without the other — but a few things are genuinely used by both, not
duplicated:

- `wowheadLinks.ts`'s `wowheadItemUrl()` and `WOWHEAD_BASE`: the loot table links items
  generically, while `Recipes/src/search.ts`'s `wowheadUrl()`/`wowheadKind()` — the
  profession-aware spell-vs-item rule, which is Recipes-only domain logic — is built on
  top of the same `WOWHEAD_BASE`.
- `text.ts`'s `fold()`: both search bars fold accents/case the same way.
- `wowhead.ts`'s `useWowheadTooltips()` and `SiteNav.tsx`: identical DOM/nav behaviour
  on every page.
- `styles.css` and `test/setup.ts`: one visual theme, one vitest environment, for the
  whole site.

Imports crossing this boundary look like `../../src/shared/text` (from
`Recipes/src/search.ts`) — two levels up from `<Service>/src/` lands at the repo root,
then into `src/shared/`. That relative-path ugliness is the price of physical
separation; do not "fix" it by adding a path alias unless a real pain point (not just
aesthetics) shows up, since this project deliberately avoids config surface it doesn't
need (see "Gotchas").

### The landing page

`src/landing/Landing.tsx` is the site root's whole UI: two link-cards, one to
`./Recipes/`, one to `./p3-loot-prio/`. It does not render `SiteNav` — the two cards
already are the site's entire navigation from here. `SiteNav` (in `src/shared/`) is
what the two service pages use to link back to the landing page and to each other, and
it renders on every page *except* this one.

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
2. Create `Recipes/data/exports/<crafter>-<profession>.txt` and paste all chunks into
   it, one per line. Optional `#` comment lines at the top are ignored by the parser.
   The file name is cosmetic — crafter and profession come from the header *inside*
   each payload, so a typo'd filename or the wrong case still imports correctly.
3. `npm run import` — folds the new recipes into `recipes.json`, regenerates
   `Recipes/src/data/registry.stats.ts` (the count snapshot the test checks), prints a
   summary of what was added vs. already known, and deletes the `.txt` files it
   consumed.
4. `npm test`, then commit the changed `recipes.json` **and** `registry.stats.ts`.
   Committing the JSON is what makes the data permanent and shared; the `.txt` is
   disposable staging.

Because re-importing is idempotent, it is safe to drop a member's *entire* fresh export
in each time — only their genuinely new recipes land in the registry. The test count
updates itself (via `registry.stats.ts`), so there is nothing to hand-edit when the
registry legitimately grows.

## Armory links

Crafter names link to their Classic Armory profile via `armoryUrl()` in
`Recipes/src/armory.ts`:

```
https://classic-armory.org/character/<region>/<version>/<realm>/<Name>
```

Region, version and realm are module constants (`eu` / `tbc-anniversary` /
`spineshatter`) because the whole guild is on one realm; only the name varies. Change
those three constants if the guild moves or the app is reused elsewhere — nothing is
hardcoded per character.

Names are percent-encoded (`Slavongîga` → `Slavong%C3%AEga`) and used with the exact
casing stored in the data.

## Alt/main groups

A recipe is credited to the character who has it learned, but that character is often
an alt the player rarely logs in on. `Recipes/src/alts.ts` maps each player's whole
roster so the table can show a crafter's *other* characters in brackets — e.g.
`Slavongîga [Slavongiga, Slavon]` — letting you whisper an online alt instead. Each
bracketed name is itself an armory link.

- `ALT_GROUPS` is the editable roster list — one array per player. Add or extend a
  group to wire a member up everywhere; no other change is needed.
- `relatedAlts(name)` returns the *other* names in that name's group, matched
  case-insensitively but **accent-sensitively** (so `Slavongiga` and `Slavongîga` are
  separate entries that both resolve to the same roster). It is purely presentational —
  it does **not** merge crafters in the data or the search index.

## Known data quirk

The Enchanting export is under **`Slavongiga`**; Jewelcrafting and Leatherworking are
under **`Slavongîga`** (circumflex î). These are treated as **two different crafters**,
because the parser cannot know whether that is one character whose name was
transliterated or two genuinely distinct alts.

Search folds accents, so typing `slavongiga` finds both. If they are meant to be one
character, normalize the header inside the export files rather than adding
accent-folding to `merge.ts` — the merge key should stay faithful to the source data.
The two spellings are also grouped in `ALT_GROUPS` (see "Alt/main groups"), so each is
shown as the other's alt in the table regardless of how the data keys them.

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

`wowheadKind()` in `Recipes/src/search.ts` encodes the rule. It was validated by
querying Wowhead's TBC tooltip API (`nether.wowhead.com/tbc/tooltip/{item,spell}/<id>`)
for **all 1132 committed recipes as of that check — every one resolves**, including
Engineering, which follows the item-ID rule like every non-Enchanting profession. If
you add a profession that breaks the pattern, that is where to fix it. The count has
grown since (see the registry section above); recipes added after that validation
follow the same rule but haven't individually been re-queried against the API.

The `Recipe.id` field is deliberately named `id`, not `spellId`, for this reason.

Alchemy `Transmute: X` recipes resolve as items to the *product* (`Transmute: Skyfire
Diamond` → `Skyfire Diamond`), which is the more useful tooltip. That is intended.

### Tooltips

`Recipes/index.html` and `p3-loot-prio/index.html` each load Wowhead's `power.js`,
which attaches hover tooltips to any link pointing at wowhead.com and reads the TBC
branch from the `/tbc/` path in our hrefs. The landing page does not load it — it has
no Wowhead links.

- `renameLinks` is **off** — recipe/item names come from the registry (originally the
  addon export, or the loot prio source) and stay authoritative.
- `colorLinks` and `iconizeLinks` are on. The CSS puts the fallback colour on the
  `td` and sets `a { color: inherit }` so Wowhead's injected `.q1`–`.q5` quality
  classes win when the script loads, and links stay readable gold when it does not.
- Because each page is a SPA, `useWowheadTooltips()` (in `src/shared/wowhead.ts`) calls
  `$WowheadPower.refreshLinks()` whenever the visible rows change. Without it, only the
  rows present on first paint get tooltips. It no-ops when the script is missing (ad
  blocker, offline, jsdom).

Change `WOWHEAD_BASE` in `src/shared/wowheadLinks.ts` for a different expansion —
`/wotlk/`, `/classic/`, or `https://www.wowhead.com/` for retail. It backs both
`Recipes/src/search.ts`'s `wowheadUrl()` and the shared `wowheadItemUrl()`.

## Nothing renders until you narrow the list

`App` (in `Recipes/src/App.tsx`) holds the table behind a `visible` gate: **2+
characters of search text, OR a profession, OR a crafter** (a one-letter query is
deliberately not enough). Until then it shows a prompt plus a "Show all N recipes"
button — browsing is still possible, just opt-in.

This is not cosmetic. Rendering all ~1150 recipes means roughly **3400+ anchors**, and
`refreshLinks()` then has power.js resolve every one of them — with `iconizeLinks` on,
that is an icon request per link, on every visit, most of them for rows nobody looked
at.

Two consequences to know before changing it:

- The profession and crafter dropdowns reveal the table **on their own**. Gating on the
  search box alone would make picking "Alchemy" show nothing, which reads as a bug.
- `refreshLinks()` is no longer called on first paint, because there is no table to
  scan. `App.test.tsx` asserts this — that assertion *is* the saving, so a failure
  there means the gate has regressed, not that the test is wrong.

## The P3 loot prio page

`/p3-loot-prio/` is a searchable copy of the Phase 3 loot priority table from
<https://www.tbcguides.gg/p3-loot-prio/> — the one below "Last update made as of Jan
26th." on that page. 217 rows: Black Temple, Mount Hyjal, and crafted gear.

`p3-loot-prio/src/p3-loot-prio.json` is a **committed snapshot**, not a live fetch. The
source is a WordPress "Ninja Tables" widget with no API, so refreshing it means
re-scraping the rendered HTML.

### The item IDs are ours, not the source's

The source table renders item names as **plain text** — there is nothing to link. Each
name was resolved to a Wowhead TBC item ID via
`https://www.wowhead.com/tbc/search/suggestions-template?q=<name>`, and every resulting
ID was then verified to return a tooltip from `nether.wowhead.com/tbc/tooltip/item/<id>`
(all 207 unique IDs resolve). That is what turns the table into hoverable, quality-
coloured item links.

Fourteen names needed a manual mapping, because the guide's spelling is not the
database's:

- typos and near-misses — `Fist of Mukoa` → *Fists of Mukoa*, `Twisted Blade of Zarak` →
  *Twisted Blades of Zarak*, `Choker of the Serrated Blades` → *Choker of Serrated
  Blades*, `Antonida's …` → *Antonidas's …*, `Shady Dealer's Pantaloon` → *…Pantaloons*;
- rows the guide splits by context — `Stormrage Signet Ring (average guild)` and
  `(speedrun)` are the same item 32497, as are the two `Cursed Vision of Sargeras`,
  `Zhar'doom` and `Shroud of the Highborne` rows.

**Displayed names keep the guide's wording**, brackets and typos included — `renameLinks`
is off, so the text is ours to own, and the bracketed context is the whole point of
those duplicate rows. `LootPrio.test.tsx` asserts this.

### Quality colours without power.js

`quality` is stored per row, and `LootPrioTable` puts `q1`–`q5` on the **`<td>`**, with
`a { color: inherit }`. Wowhead's injected classes land on the `<a>` and win once
power.js loads; the cell class is the fallback for an ad blocker, an offline visit, or
jsdom. Same trick the recipe table uses for its gold fallback — see "Tooltips".

Unlike the recipe table there is **no visibility gate** here: 217 rows is one anchor
each (~217 icon requests), not the ~3400+ the registry would render, so the table is
shown immediately and the filters only narrow it.

## Testing

109 tests across 12 files, split across the two services' folders — Recipes tests live
under `Recipes/src/`, loot prio tests under `p3-loot-prio/src/`. The suite deliberately
mixes synthetic fixtures with **real addon payloads**
(`Recipes/src/test/fixtures.ts`) so encoding regressions surface immediately.

- `Recipes/src/parser/*.test.ts` cover decode/parse/merge against synthetic fixtures
  and real payloads.
- `Recipes/src/data/consolidate.test.ts` covers the fold-in rules (new IDs added,
  existing IDs credited to a new crafter, re-exports skipped, input registry never
  mutated, case-insensitive/accent-sensitive crafter matching) and the count snapshot
  helpers.
- `Recipes/src/data/loadExports.test.ts` asserts the committed `recipes.json` loads to
  exactly the counts recorded in `registry.stats.ts` (currently **1148 recipes / 25
  crafters / 8 professions**).
- `p3-loot-prio/src/lootData.test.ts` covers filtering and asserts the committed loot
  snapshot still holds **217 rows, each with a resolved item ID** — the same "did an
  edit drop data?" guard the registry count test provides.

### The count is self-updating but still load-bearing

`npm run import` regenerates `Recipes/src/data/registry.stats.ts` from the freshly
written registry, so the expected number tracks the data — there is nothing to
hand-edit when a member's export adds recipes. Because **only** the import path
rewrites that snapshot, it still catches the failure that matters: a lossy or corrupt
edit to `recipes.json` made *without* running import leaves the snapshot stale, and
`loadExports.test.ts` fails loudly. Do not edit `registry.stats.ts` by hand. If a
`recipes.json` edit legitimately adds a new profession (not just new recipes/crafters),
`loadExports.test.ts`'s hardcoded profession list also needs updating by hand — that
one isn't auto-generated.

## Gotchas

- `vitest` and `vite` major versions must stay compatible. Vitest 2 pins Vite 5; with
  Vite 6 installed npm nests a second copy and `vite.config.ts` fails to typecheck with
  a confusing `Plugin<any> is not assignable to PluginOption` error. The fix is aligning
  versions, not casting.
- `vite.config.ts` imports `defineConfig` from **`vitest/config`**, not `vite`, so the
  `test` key typechecks.
- The `import.meta.glob` for `recipes.json` in `Recipes/src/data/loadExports.ts` is
  deliberately **not** `eager`. Eager inlines the recipe data into the main bundle;
  lazy splits it into its own chunk fetched after first paint (`recipes-*.js`, ~15 kB
  gzip), keeping the initial bundle to the shell. This is why the loader is async —
  make it sync and you undo the split.
- That glob uses absolute paths (`/Recipes/recipes.json`, `/Recipes/data/*.json`) so it
  resolves from the Vite root (repo root), not relative to `Recipes/src/`. It also
  means **`Recipes/data/` is reserved for recipe registries** — any other JSON dropped
  there is loaded as one and corrupts the index. That is why the loot snapshot lives in
  `p3-loot-prio/src/`, not `Recipes/data/`.
- All three pages are listed in `build.rollupOptions.input` (`vite.config.ts`) as paths
  **relative to Vite's root**. The usual `resolve(__dirname, …)` spelling would need
  `@types/node`, which this project does not carry and `tsc -b` would reject.
- Nav hrefs in `SiteNav.tsx` (`src/shared/`) are relative and differ per page because
  `base: './'` has to survive a GitHub Pages subpath — nothing may start with a leading
  `/`. `Recipes/` and `p3-loot-prio/` are siblings one level below the site root, so
  each reaches home via `../` and the other service via `../<sibling>/`; a leading `/`
  works locally and 404s in production.
- macOS has a **case-insensitive filesystem**: a module named `lootPrio.ts` next to a
  component named `LootPrio.tsx` makes `import … from './LootPrio'` resolve to the
  *wrong* file (`.ts` is tried first), and React fails with "Element type is invalid …
  got undefined". Hence `lootData.ts`. Don't reintroduce a name that differs only by
  case.
- `Recipes/scripts/import-exports.ts` runs under **vite-node**, not plain `node`,
  because it imports the app's extensionless-import TypeScript (`../src/parser`,
  relative to the script's own location). Node's native loader can't resolve those;
  vite-node reuses Vite's resolver. It is invoked by path (`node
  node_modules/vite-node/vite-node.mjs Recipes/scripts/import-exports.ts`) since npm
  doesn't symlink a bin for a transitive dep — `vite-node` is listed as a direct
  devDependency to pin it. The script resolves its own paths (registry, stats, exports
  folder) relative to `import.meta.url`, so it stayed correct across the `Recipes/`
  move with zero code changes — only the invocation path in `package.json` changed.
- Code crossing the `src/shared/` boundary uses relative paths like
  `../../src/shared/text`, not a tsconfig/vite path alias — see "Why `src/shared/`
  exists". Don't add an alias to tidy this up without a concrete need; it's config
  surface this project has deliberately avoided elsewhere too (see the `@types/node`
  point above).
