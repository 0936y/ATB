# Discord Import Bot Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let guild members upload their profession export as a Discord attachment and have the live site update itself automatically, with no local `npm run import` step for anyone.

**Architecture:** The bot never parses or merges recipe data — it commits the raw export bytes verbatim into `Recipes/data/exports/` via the GitHub Contents API. A new GitHub Actions workflow, triggered by that push, runs the existing `npm run import` pipeline and commits the result back to `main`, which triggers the existing `deploy.yml`. The bot's source lives outside this repository.

**Tech Stack:** GitHub Actions (YAML), Python 3.10 (`discord.py`, `requests`, `python-dotenv`), systemd.

**Spec:** `docs/superpowers/specs/2026-08-25-discord-import-bot-design.md`

## Global Constraints

- The bot never reimplements `decode.ts`/`parse.ts`/`merge.ts`/`consolidate.ts`. All parsing/merging stays exclusively in the existing TypeScript pipeline.
- Imports push directly to `main` — no PR review step.
- No Discord failure-notification webhook in this plan (explicitly out of scope for v1).
- No hosting automation beyond a systemd unit file — the user deploys it by hand.
- The bot's Python source is **not** committed to this git repository. It is written to the session scratchpad only: `/private/tmp/claude-501/-Volumes-AProject-Projects-WoW-Web-Recipes/65e0683d-303d-4271-a5df-608f4e7bff31/scratchpad/discord-bot/`.
- The CI workflow's push-back to `main` MUST use the `IMPORT_PUSH_TOKEN` repo secret (a PAT), never the default `GITHUB_TOKEN` — GitHub blocks `GITHUB_TOKEN`-authored pushes from triggering further workflow runs, which would silently stop `deploy.yml` from firing after every import.
- `deploy.yml` gets exactly one added line: `paths-ignore: ['Recipes/data/exports/**']` on its `push` trigger. No other change to that file.
- Staged filenames must incorporate the Discord interaction ID so concurrent imports (even from the same crafter) can never collide.
- The bot's best-effort peek-decode (used only for filename/message cosmetics) must never block or fail the staging write — wrap it in try/except with a generic fallback.
- `/who_crafts` fetches `recipes.json` from `raw.githubusercontent.com` with a ~60s in-memory cache.
- Bot dependencies are exactly `discord.py`, `python-dotenv`, `requests` — no `PyGithub`, no local git clone/CLI usage.

---

## Prerequisites (user-owned, not part of this plan's tasks)

- A fine-grained GitHub PAT with `Contents: Read and write` on `0936y/ATB` must exist, added as the repo secret `IMPORT_PUSH_TOKEN` (Settings → Secrets and variables → Actions). Task 2's workflow will not function until this secret exists, though the file itself can still be written and committed without it.
- The same (or a second) PAT, plus the Discord bot token, go into the bot's `.env` on the user's server (Task 3 produces `.env.example` as the template).

---

### Task 1: `deploy.yml` — ignore the staging path

**Files:**
- Modify: `.github/workflows/deploy.yml:3-6`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks — this is a standalone one-line trigger change.

- [ ] **Step 1: Edit the `push` trigger**

Change:
```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```
to:
```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'Recipes/data/exports/**'
  workflow_dispatch:
```

- [ ] **Step 2: Verify the diff is exactly this one addition**

Run: `git diff .github/workflows/deploy.yml`
Expected: only the `paths-ignore` block added; no other lines touched. (No YAML linter is installed in this project and none is being added for a one-line, hand-verifiable change — see the "Gotchas" section of `CLAUDE.md` on deliberately avoiding extra config surface. The real functional check happens in Task 6, where a staging-only push must NOT trigger this workflow.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Ignore Recipes/data/exports/ pushes in the deploy workflow trigger"
```

---

### Task 2: New workflow — `import-exports.yml`

**Files:**
- Create: `.github/workflows/import-exports.yml`

**Interfaces:**
- Consumes: the existing `npm run import` script (`Recipes/scripts/import-exports.ts`, unchanged) and `npm test`. Triggered by pushes to `main` under `Recipes/data/exports/**` — the path the bot (Task 3) writes to.
- Produces: on success, an updated `recipes.json` + `registry.stats.ts` commit on `main`, which triggers `deploy.yml` — see the note after Step 1 for why this commit is not excluded by Task 1's `paths-ignore`, even though it also deletes files under `Recipes/data/exports/**`.

- [ ] **Step 1: Write the workflow file**

```yaml
name: Import staged profession exports

on:
  push:
    branches: [main]
    paths:
      - 'Recipes/data/exports/**'
  workflow_dispatch:

# This job's own push-back to main (see the final step) deliberately uses the
# IMPORT_PUSH_TOKEN PAT secret, NOT the default GITHUB_TOKEN. GitHub blocks
# GITHUB_TOKEN-authored pushes from triggering further workflow runs (to
# prevent recursive loops) — using it here would silently stop deploy.yml
# from firing after every import. Do not "simplify" this back to
# GITHUB_TOKEN.
permissions:
  contents: read

concurrency:
  group: import-exports
  cancel-in-progress: false

jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          token: ${{ secrets.IMPORT_PUSH_TOKEN }}

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run import

      - run: npm test

      - name: Commit and push the folded registry
        run: |
          if [ -z "$(git status --porcelain)" ]; then
            echo "No changes after import — nothing to commit."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Recipes/recipes.json Recipes/src/data/registry.stats.ts Recipes/data/exports
          git commit -m "Import staged profession exports"
          git push origin HEAD:main
```

Note on the "Produces" line above: `deploy.yml`'s `paths-ignore` (Task 1) excludes pushes that touch *only* `Recipes/data/exports/**`. This job's follow-up commit touches `Recipes/recipes.json` and `Recipes/src/data/registry.stats.ts` (outside that path) in the same commit as the exports deletion, so `paths-ignore` does **not** exclude it — `deploy.yml` still fires, correctly, from this commit. It's the bot's *own* staging-only commit (Task 3) that gets excluded, since that one touches nothing but `Recipes/data/exports/**`.

- [ ] **Step 2: Self-review against the existing `deploy.yml` conventions**

Run: `git diff --no-index .github/workflows/deploy.yml .github/workflows/import-exports.yml | head -50` (or just read both files side by side)
Confirm: same `actions/checkout@v7` / `actions/setup-node@v7` versions, same `node-version: 22`, same `cache: npm` convention as `deploy.yml` — no unexplained version drift between the two workflows.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/import-exports.yml
git commit -m "Add CI workflow to fold staged profession exports into recipes.json"
```

---

### Task 3: Bot deliverables (external — not committed to this repo)

**Files:**
- Create: `<scratchpad>/discord-bot/bot.py`
- Create: `<scratchpad>/discord-bot/requirements.txt`
- Create: `<scratchpad>/discord-bot/.env.example`
- Create: `<scratchpad>/discord-bot/wow-import-bot.service`

where `<scratchpad>` is `/private/tmp/claude-501/-Volumes-AProject-Projects-WoW-Web-Recipes/65e0683d-303d-4271-a5df-608f4e7bff31/scratchpad`.

**Interfaces:**
- Consumes: `Recipes/data/exports/` as the staging path and `Recipes/recipes.json` as the read path (both exact paths from `CLAUDE.md` and the spec) — these are string constants in `bot.py`, not imports, since this file lives outside the TS project entirely.
- Produces: nothing consumed by other tasks in this repo. Task 6's end-to-end verification exercises this bot's write path manually (or via a curl standing in for it — see Task 6).

- [ ] **Step 1: Write `requirements.txt`**

```
discord.py
python-dotenv
requests
```

- [ ] **Step 2: Write `.env.example`**

```
BOT_TOKEN=your-discord-bot-token
GITHUB_TOKEN=your-github-pat-with-contents-write-on-0936y-ATB
GITHUB_REPO=0936y/ATB
```

- [ ] **Step 3: Write `bot.py`**

```python
import base64
import os
import re
import time

import discord
import requests
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO", "0936y/ATB")

EXPORTS_PATH = "Recipes/data/exports"
RECIPES_RAW_URL = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/Recipes/recipes.json"
CACHE_TTL_SECONDS = 60

intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)

_cache = {"data": None, "fetched_at": 0.0}


def peek_header(raw_text: str):
    """Best-effort, non-blocking peek at the first payload's crafter/profession.

    Used only to make the staged filename and the Discord confirmation message
    readable — never blocks or fails the actual staging write. The real parse
    happens later in CI via the existing TypeScript pipeline.
    """
    try:
        match = re.search(r"!profession import (\S+)", raw_text)
        if not match:
            return None, None
        b64 = match.group(1)
        padded = b64 + "=" * (-len(b64) % 4)
        decoded = base64.b64decode(padded).decode("utf-8")
        header = decoded.splitlines()[0]
        crafter, profession, *_ = header.split("|")
        return crafter.strip(), profession.strip()
    except Exception:
        return None, None


def safe_slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", value)[:40]


async def stage_export(interaction: discord.Interaction, content_bytes: bytes):
    """PUT the raw export bytes verbatim into Recipes/data/exports/ on main via
    the GitHub Contents API. Returns (repo_path, crafter_or_None, profession_or_None).
    """
    text = content_bytes.decode("utf-8", errors="replace")
    crafter, profession = peek_header(text)
    if crafter and profession:
        name = f"{safe_slug(crafter)}-{safe_slug(profession)}-{interaction.id}.txt"
    else:
        name = f"import-{interaction.id}.txt"

    path = f"{EXPORTS_PATH}/{name}"
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    resp = requests.put(
        url,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
        },
        json={
            "message": f"Stage export: {name}",
            "content": base64.b64encode(content_bytes).decode("ascii"),
            "branch": "main",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return path, crafter, profession


def fetch_recipes() -> dict:
    now = time.time()
    if _cache["data"] is not None and now - _cache["fetched_at"] < CACHE_TTL_SECONDS:
        return _cache["data"]
    resp = requests.get(RECIPES_RAW_URL, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    _cache["data"] = data
    _cache["fetched_at"] = now
    return data


@client.event
async def on_ready():
    synced = await tree.sync()
    print(f"Logged in as {client.user} ({len(synced)} commands synced)")


@tree.command(name="import", description="Import a WoW profession export file")
@app_commands.describe(file="The .txt file containing your `!profession import ...` lines")
async def import_profession(interaction: discord.Interaction, file: discord.Attachment):
    await interaction.response.defer(thinking=True)
    try:
        content_bytes = await file.read()
        path, crafter, profession = await stage_export(interaction, content_bytes)

        if crafter and profession:
            await interaction.followup.send(
                f"✅ Staged **{crafter}**'s {profession} export as `{path}`.\n"
                f"CI will fold it into the registry in a minute or two — the site updates automatically."
            )
        else:
            await interaction.followup.send(
                f"✅ Staged `{path}`.\n"
                f"CI will fold it into the registry in a minute or two — the site updates automatically."
            )
    except requests.HTTPError as e:
        detail = e.response.text if e.response is not None else str(e)
        await interaction.followup.send(f"❌ Import failed:\n{detail[:500]}", ephemeral=True)
    except Exception as e:
        await interaction.followup.send(f"❌ Import failed:\n{e}", ephemeral=True)


@tree.command(name="who_crafts", description="Find who can craft a recipe by name")
@app_commands.describe(name="Name of craftable")
async def who_crafts(interaction: discord.Interaction, name: str):
    await interaction.response.defer(thinking=True)
    try:
        data = fetch_recipes()
    except Exception as e:
        await interaction.followup.send(f"❌ Could not fetch the registry:\n{e}", ephemeral=True)
        return

    name_lower = name.lower()
    results = [r for r in data.values() if name_lower in r["name"].lower()]

    if results:
        recipe = results[0]
        crafters = ", ".join(recipe["crafters"])
        await interaction.followup.send(
            f"🧪 **{recipe['name']}** ({name})\n"
            f"🛠 Profession: {recipe['profession']}\n"
            f"👥 Crafters: {crafters}"
        )
    else:
        await interaction.followup.send("❌ No one crafts this :(")


client.run(TOKEN)
```

- [ ] **Step 4: Syntax-check `bot.py`**

Run: `python3 -m py_compile <scratchpad>/discord-bot/bot.py`
Expected: exits 0, no output. (No import-time check here — `discord`/`requests`/`dotenv` aren't installed on this dev machine; that happens on the target server in Task 4. `py_compile` catches syntax errors, which is what a static review of this file can meaningfully verify from here.)

- [ ] **Step 5: Write `wow-import-bot.service`**

```ini
[Unit]
Description=WoW guild Discord import bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/wow-import-bot
EnvironmentFile=/opt/wow-import-bot/.env
ExecStart=/opt/wow-import-bot/venv/bin/python3 /opt/wow-import-bot/bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Note in the handoff message (Task 4) that `/opt/wow-import-bot` is a placeholder — the user should either deploy to that exact path or edit the three paths in this file to match wherever they actually place the bot on their server.

No commit step for this task — per the Global Constraints, none of these four files are tracked in this git repository.

---

### Task 4: Hand off bot deliverables to the user

**Files:** none (communication-only task).

**Interfaces:**
- Consumes: the four files from Task 3.
- Produces: nothing — this is the point where the user copies files to their server.

- [ ] **Step 1: Tell the user the scratchpad path and the exact deploy commands**

Message content (send as-is, adjusting only if the user's target directory differs from `/opt/wow-import-bot`):

```
Files are ready in <scratchpad>/discord-bot/. On your server:

  scp <scratchpad>/discord-bot/* youruser@yourserver:/opt/wow-import-bot/
  cd /opt/wow-import-bot
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  cp .env.example .env   # edit in BOT_TOKEN, GITHUB_TOKEN, GITHUB_REPO
  deactivate
  sudo cp wow-import-bot.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now wow-import-bot
  sudo systemctl status wow-import-bot
  journalctl -u wow-import-bot -f   # tail logs to confirm it logged in
```

- [ ] **Step 2: Confirm with the user that the bot is running and `/import` and `/who_crafts` show up as slash commands in Discord before proceeding to Task 6.**

This step has no automated check — it depends on the user's own server and Discord client. Wait for their confirmation.

---

### Task 5: `IMPORT_PUSH_TOKEN` repo secret confirmation

**Files:** none.

**Interfaces:**
- Consumes: nothing.
- Produces: the secret Task 2's workflow reads via `secrets.IMPORT_PUSH_TOKEN`.

- [ ] **Step 1: Confirm the secret exists**

Ask the user to confirm (or add now) a repo secret named exactly `IMPORT_PUSH_TOKEN` at `https://github.com/0936y/ATB/settings/secrets/actions`, holding a fine-grained PAT scoped to `0936y/ATB` with `Contents: Read and write`. Do not proceed to Task 6 until confirmed — Task 2's workflow will run but fail at the push step without it, leaving a stray commit-less `.txt` staged in the repo.

---

### Task 6: End-to-end verification

**⚠️ This task pushes to `main` on the live repo and will, on success, trigger a real production deploy. Confirm with the user before running Step 1 — do not run it unattended.**

**Files:**
- Create (transient): `Recipes/data/exports/e2e-test-<timestamp>.txt` — deleted by the import workflow itself as part of its normal run; nothing to clean up manually on success.

**Interfaces:**
- Consumes: Task 2's `import-exports.yml`, Task 1's `deploy.yml` trigger change, the real `recipes.json`/`consolidate.ts` pipeline (unchanged).
- Produces: proof the full chain works, or a specific failure point to fix before calling this plan done.

- [ ] **Step 1: Push a synthetic test export directly (standing in for the bot, which Task 4 already verified can reach Discord — this step isolates the CI half of the chain)**

```bash
mkdir -p Recipes/data/exports
cat > Recipes/data/exports/e2e-test-plan-verification.txt <<'EOF'
E2E Test Character|Tailoring|
Plan Verification Test Item#999999999
EOF
git add Recipes/data/exports/e2e-test-plan-verification.txt
git commit -m "test: e2e verification of import-exports.yml (temporary)"
git push origin main
```

- [ ] **Step 2: Confirm `deploy.yml` did NOT fire on this commit**

Run: `gh run list --workflow=deploy.yml --limit=3` (or check the Actions tab in the browser)
Expected: no new run corresponding to the commit from Step 1 — this proves Task 1's `paths-ignore` worked, since this commit touches only `Recipes/data/exports/**`.

- [ ] **Step 3: Confirm `import-exports.yml` ran and succeeded**

Run: `gh run list --workflow=import-exports.yml --limit=3`
Expected: a run triggered by the Step 1 commit, status `success`.

- [ ] **Step 4: Confirm the follow-up commit landed and `deploy.yml` fired from it**

Run: `git log --oneline -5` (after `git pull`) and `gh run list --workflow=deploy.yml --limit=3`
Expected: a new commit `Import staged profession exports` authored by `github-actions[bot]`, touching `Recipes/recipes.json` and `Recipes/src/data/registry.stats.ts`, and a `deploy.yml` run triggered by it.

- [ ] **Step 5: Confirm the test recipe is live, then revert it**

Run: `curl -s https://raw.githubusercontent.com/0936y/ATB/main/Recipes/recipes.json | grep "Plan Verification Test Item"`
Expected: the test entry is present, confirming the full chain (stage → CI import → consolidate → commit → deploy trigger) worked end to end.

Then remove the synthetic test data by reverting the CI's own commit — `git revert` restores `recipes.json` and `registry.stats.ts` to their exact prior byte-for-byte state in one step, since that commit's only content was adding the one test recipe and deleting the staged `.txt` (no hand-editing JSON, no recomputing stats separately, no risk of the two files drifting out of sync):

```bash
git pull
CI_COMMIT=$(git log --format='%H %s' -20 | grep "Import staged profession exports" | head -1 | cut -d' ' -f1)
git revert --no-edit "$CI_COMMIT"
npm test
git push origin main
```

This revert commit touches `Recipes/recipes.json` and `Recipes/src/data/registry.stats.ts` (not `Recipes/data/exports/**`), so it correctly triggers `deploy.yml` again (removing the test data from the live site) without re-triggering `import-exports.yml`.

- [ ] **Step 6: Final confirmation**

Run: `sleep 90 && curl -s https://raw.githubusercontent.com/0936y/ATB/main/Recipes/recipes.json | grep "Plan Verification Test Item"`
Expected: no output (grep finds nothing) — confirms the revert deployed and the live site no longer serves the synthetic test recipe. (`npm test` already passed locally in Step 5 before the push; this step confirms the *deployed* state, not just the local one.)

---

## Definition of done

- `deploy.yml` ignores pushes touching only `Recipes/data/exports/**`.
- `import-exports.yml` exists, triggers on exactly that path, and successfully folds a staged export into `recipes.json` + `registry.stats.ts`, pushing back to `main` with a token that allows `deploy.yml` to fire.
- The bot is running on the user's server as a systemd service, `/import` stages files via the GitHub API with no local parsing, and `/who_crafts` reads live from `raw.githubusercontent.com`.
- Task 6's end-to-end run proved the full chain works and left the repo in a clean state (no leftover synthetic test data).
