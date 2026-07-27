# Export staging area

Drop a guild member's addon exports here as `.txt` files (the raw
`!profession import <base64>` lines from the Profession Bot Exporter addon), then
run:

```
npm run import
```

That folds anything **new** into `../../recipes.json` — the master registry the
app actually reads — and **empties this folder**. The addon dumps a character's
entire recipe book every time, so most lines already exist; only new recipe IDs
and new crafters for a known ID are added. Commit the changed `recipes.json`.

Nothing at runtime reads this directory — it is staging only. This README keeps
the (otherwise empty) folder in git.
