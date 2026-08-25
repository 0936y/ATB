# Discord import bot integration — design

Date: 2026-08-25
Status: approved (pending spec review sign-off)

## Goal

Guild members currently hand their `!profession import <base64>` chat lines to an
officer, who pastes them into `Recipes/data/exports/<name>.txt`, runs `npm run
import` locally, and pushes. This replaces the manual hand-off with a Discord bot:
a member uploads their export as a Discord attachment, and the site updates itself
within a couple of minutes, with no local `npm run import` step for anyone.

## Non-goals

- The bot does not reimplement `decode.ts`/`parse.ts`/`merge.ts`/`consolidate.ts` in
  Python. That logic stays in one place (TypeScript, exercised by the existing test
  suite) to avoid two parsers silently drifting apart — see CLAUDE.md's "Parser
  rules (do not regress these)" and the accent/case-sensitivity note under "Known
  data quirk".
- No PR-based review step for imports — pushes go straight to `main`, matching how
  this already works today (an officer pushes directly after a local import).
- No Discord failure-notification webhook for v1. CI failures surface as failed runs
  in the GitHub Actions tab; this can be added later without changing the shape of
  anything here.
- No automation of the bot's own hosting beyond a systemd unit file — the user
  deploys it to their own server by hand.
- The bot's Python source is **not** tracked in this repository. It's delivered as
  standalone files (see "Deliverables" below); only the two CI-side changes below
  land in this repo.

## Architecture

```
Discord /import (attachment: raw "!profession import <b64>" lines)
   │
   │  bot: PUT /repos/0936y/ATB/contents/Recipes/data/exports/<name>.txt
   │       (GitHub Contents API, direct commit to main)
   ▼
Recipes/data/exports/<crafter>-<profession>-<interaction-id>.txt  (on main)
   │
   │  triggers: .github/workflows/import-exports.yml
   │  (push to main, paths: Recipes/data/exports/**)
   ▼
CI: npm ci → npm run import → npm test
   │  (existing TS pipeline: decode → parse → merge → consolidate →
   │   rewrite recipes.json + registry.stats.ts → delete the .txt)
   │
   │  if recipes.json/registry.stats.ts changed: commit + push to main
   │  using a PAT secret (NOT the default GITHUB_TOKEN — see below)
   ▼
recipes.json + registry.stats.ts updated on main
   │
   │  triggers: .github/workflows/deploy.yml (existing, unchanged trigger shape)
   ▼
npm test → npm run build → GitHub Pages deploy
```

`/who_crafts` is a read path only: the bot fetches
`https://raw.githubusercontent.com/0936y/ATB/main/Recipes/recipes.json` directly
(public repo, no auth) and searches it in-memory, with a ~60s cache to avoid
refetching on every query.

### Why the bot never parses

Reusing the existing pipeline means the bot's write path is "commit these bytes
verbatim" — no base64 decoding, no chunk merging, no accent/case rules to get right
twice. The only Python-side parsing is a **best-effort, non-blocking peek** at the
first `!profession import <b64>` block, used purely to make the staged filename and
the Discord confirmation message readable (e.g. `Slavongiga-Enchanting-...txt`
instead of a bare interaction ID). If that peek fails for any reason, the bot falls
back to a generic filename and still stages the file — CLAUDE.md already treats the
staging filename as cosmetic, since crafter/profession are read from the header
inside the payload, not the filename.

### The self-terminating double-CI-run quirk

The import workflow's own follow-up commit deletes the `.txt` file it just
processed. That deletion is itself a change under `Recipes/data/exports/**`, so it
re-triggers `import-exports.yml` a second time. That second run finds the folder
empty, logs `data/exports/ has no .txt files — nothing to import.` (existing
behavior, unchanged), and exits without committing anything — so it doesn't cascade
further. This is an accepted one-extra-idle-CI-run-per-import cost, not a bug to
work around.

### Why the PAT, not `GITHUB_TOKEN`, for the CI push-back

GitHub does not allow the default `GITHUB_TOKEN` to trigger downstream workflow
runs, specifically to prevent recursive workflow chains. If `import-exports.yml`
pushed `recipes.json` using the default token, `deploy.yml` would never fire and
the site would silently stop updating after every import. The workflow must
authenticate that push with a repo-scoped PAT, stored as the repo secret
`IMPORT_PUSH_TOKEN`, instead.

### `deploy.yml` tweak

Add `paths-ignore: ['Recipes/data/exports/**']` to its existing `push` trigger.
Without this, the bot's raw-staging commit (which lands on `main` before the import
workflow has run) would also kick off a redundant build+deploy of the *unchanged*
site, seconds before the real one. One line, no other change to that workflow.

## Repo-side deliverables (this repository)

1. **New file** `.github/workflows/import-exports.yml`:
   - Trigger: `push` to `main`, `paths: ['Recipes/data/exports/**']`.
   - Steps: checkout, setup-node@22, `npm ci`, `npm run import`, `npm test`, then —
     only if `git status --porcelain` shows changes — configure a bot git identity,
     commit `recipes.json` + `registry.stats.ts` (and the now-deleted `.txt`), and
     push to `main` using the PAT secret.
2. **Modified** `.github/workflows/deploy.yml`: add the `paths-ignore` line above to
   the `push` trigger. No other changes.
3. A repo secret holding the PAT (contents:write, scoped to this repo only) — added
   by the user in GitHub repo settings; not something this session can create.

Nothing else in this repository changes. The Recipes app, its tests, and its
runtime data-loading path (`loadExports.ts`, `jsonRegistry.ts`) are untouched — from
their point of view, imports still arrive as ordinary commits to `recipes.json`.

## Bot deliverables (external, not tracked in this repo)

Written to the session scratchpad
(`/private/tmp/claude-501/-Volumes-AProject-Projects-WoW-Web-Recipes/65e0683d-303d-4271-a5df-608f4e7bff31/scratchpad/discord-bot/`)
for the user to copy to their server:

- `bot.py` — rewritten from the pasted script:
  - `/import <file>` — no local JSON read/write. Best-effort peek-decodes the first
    payload for naming, then `PUT`s the raw attachment bytes to
    `Recipes/data/exports/<name>.txt` via the GitHub Contents API and replies with a
    "staged, CI will fold it in shortly" message.
  - `/who_crafts <name>` — fetches `recipes.json` from `raw.githubusercontent.com`
    (60s in-memory cache) and searches it, same matching behavior as today.
  - Removed: `load_data`, `save_data`, `save_profession`, `parse_profession_text`
    used as the merge path, `DATA_FILE` local state — none of it is needed once the
    bot no longer owns the registry.
- `requirements.txt` — `discord.py`, `python-dotenv`, `requests`. No `PyGithub`, no
  local git — two plain REST calls cover the whole integration.
- `.env.example` — `BOT_TOKEN`, `GITHUB_TOKEN` (the PAT — same one used for the
  Contents API write; can be the *same* PAT as the CI secret, or a separate one with
  identical scope, user's choice), `GITHUB_REPO=0936y/ATB`.
- `wow-import-bot.service` — a systemd unit: `ExecStart=python3 bot.py` in the
  deploy directory, `Restart=always`, `EnvironmentFile=.env`, so the bot survives
  crashes and server reboots without a `screen` session to babysit.

## Error handling

- **Malformed export pasted by a member:** unchanged from today — `parse.ts` never
  throws; bad lines land in `warnings[]` and the rest of the file still imports.
  This is why the bot doesn't need to validate anything before staging.
- **CI import step or `npm test` fails** (a real bug, not bad user input — the
  parser's permissiveness means this should be rare): the workflow stops before the
  commit step, the `.txt` stays in `Recipes/data/exports/` on `main`, and the
  failure is visible in the Actions tab. No recipes.json corruption is possible
  since the commit only happens after tests pass. Out of scope for v1: proactively
  notifying Discord about this (noted above).
- **GitHub API call from the bot fails** (rate limit, bad PAT, network): `/import`
  replies with an ephemeral error message; nothing is staged, so there's nothing to
  clean up.
- **Concurrent imports:** filenames include the Discord interaction ID, so
  concurrent uploads (even from the same crafter) can never collide on the same
  staged filename.

## Testing plan

- Repo-side: no changes to `Recipes/` or `p3-loot-prio/` source, so the existing 109
  tests are unaffected. Manually verify the new workflow once by pushing a test
  `.txt` (using a throwaway/synthetic export) to `Recipes/data/exports/` on a branch
  first if the user wants a dry run, or directly on `main` since imports are
  already idempotent and low-risk.
- Bot-side: manual verification against a real (or the repo's existing) test guild —
  `/import` a small attachment, confirm the CI run appears and completes, confirm
  `recipes.json` updates, confirm `/who_crafts` reflects the new data after the
  cache TTL. No automated test suite for the bot itself (out of scope, matches the
  bot's current lack of tests).

## Secrets checklist (user-owned, not created by this session)

- Repo secret: PAT with `contents:write` on `0936y/ATB`, used by
  `import-exports.yml`'s push step.
- Bot server `.env`: Discord `BOT_TOKEN`, and a PAT with `contents:write` on
  `0936y/ATB` (same scope as above; can reuse the same token or mint a second one).
