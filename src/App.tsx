import { useEffect, useMemo, useState } from 'react'
import type { CrafterProfession } from './types'
import { loadAllEntries } from './data/loadExports'
import { buildIndex, searchRecipes } from './search'
import { Filters } from './components/Filters'
import { RecipeTable } from './components/RecipeTable'

export function App({ initialEntries }: { initialEntries?: CrafterProfession[] }) {
  const [entries, setEntries] = useState<CrafterProfession[]>(initialEntries ?? [])
  const [loading, setLoading] = useState(initialEntries === undefined)
  const [query, setQuery] = useState('')
  const [profession, setProfession] = useState('')
  const [crafter, setCrafter] = useState('')

  // The recipe data is a lazy chunk (see loadExports.ts), so it arrives after
  // first paint. Tests pass `initialEntries` and skip the fetch entirely.
  useEffect(() => {
    if (initialEntries) return
    let cancelled = false
    loadAllEntries().then((loaded) => {
      if (cancelled) return
      setEntries(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialEntries])

  const index = useMemo(() => buildIndex(entries), [entries])

  /**
   * Nothing is rendered until the user narrows the list.
   *
   * Rendering all ~1130 recipes means ~3400 anchors, and `refreshLinks()` then
   * has Wowhead's power.js fetch an icon for every one of them on each paint.
   * A two-letter minimum keeps a stray keystroke from dumping the whole table.
   */
  const [showAll, setShowAll] = useState(false)
  const visible = query.trim().length >= 2 || profession !== '' || crafter !== '' || showAll

  const results = useMemo(
    () => (visible ? searchRecipes(index, { query, profession, crafter }) : []),
    [visible, index, query, profession, crafter],
  )

  const professions = useMemo(
    () => [...new Set(entries.map((e) => e.profession))].sort(),
    [entries],
  )
  const crafters = useMemo(() => [...new Set(entries.map((e) => e.crafter))].sort(), [entries])

  return (
    <main>
      <header>
        <h1> ATB - Spineshatter Guild Recipe Registry</h1>
        <p className="stats">
          {loading
            ? 'Loading recipe data…'
            : `${index.length} recipes · ${crafters.length} crafters · ${professions.length} professions`}
        </p>
      </header>

      <Filters
        query={query}
        onQueryChange={setQuery}
        profession={profession}
        onProfessionChange={setProfession}
        crafter={crafter}
        onCrafterChange={setCrafter}
        professions={professions}
        crafters={crafters}
      />

      {visible ? (
        <>
          <p className="count">
            Showing {results.length} of {index.length}
          </p>
          <RecipeTable matches={results} />
        </>
      ) : (
        <div className="empty">
          <p>Search for a recipe, or pick a profession or crafter, to see who can craft it.</p>
          <button type="button" onClick={() => setShowAll(true)} disabled={loading}>
            Show all {index.length} recipes
          </button>
        </div>
      )}
    </main>
  )
}
