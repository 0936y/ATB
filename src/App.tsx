import { useMemo, useState } from 'react'
import type { CrafterProfession } from './types'
import { loadAllEntries } from './data/loadExports'
import { buildIndex, searchRecipes } from './search'
import { Filters } from './components/Filters'
import { RecipeTable } from './components/RecipeTable'
import { ImportPanel } from './components/ImportPanel'

export function App({ initialEntries }: { initialEntries?: CrafterProfession[] }) {
  const [entries, setEntries] = useState<CrafterProfession[]>(
    () => initialEntries ?? loadAllEntries(),
  )
  const [query, setQuery] = useState('')
  const [profession, setProfession] = useState('')
  const [crafter, setCrafter] = useState('')

  const index = useMemo(() => buildIndex(entries), [entries])
  const results = useMemo(
    () => searchRecipes(index, { query, profession, crafter }),
    [index, query, profession, crafter],
  )

  const professions = useMemo(
    () => [...new Set(entries.map((e) => e.profession))].sort(),
    [entries],
  )
  const crafters = useMemo(() => [...new Set(entries.map((e) => e.crafter))].sort(), [entries])

  /** Session imports replace a matching (crafter, profession) rather than duplicating it. */
  function handleImport(imported: CrafterProfession[]) {
    setEntries((current) => {
      const next = [...current]
      for (const entry of imported) {
        const i = next.findIndex(
          (e) =>
            e.crafter.toLowerCase() === entry.crafter.toLowerCase() &&
            e.profession.toLowerCase() === entry.profession.toLowerCase(),
        )
        if (i >= 0) next[i] = entry
        else next.push(entry)
      }
      return next
    })
  }

  return (
    <main>
      <header>
        <h1>Guild Recipe Registry</h1>
        <p className="stats">
          {index.length} recipes · {crafters.length} crafters · {professions.length} professions
        </p>
      </header>

      <ImportPanel onImport={handleImport} />

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

      <p className="count">
        Showing {results.length} of {index.length}
      </p>

      <RecipeTable matches={results} />
    </main>
  )
}
