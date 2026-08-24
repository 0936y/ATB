import { useEffect, useMemo, useState } from 'react'
import { SiteNav } from '../../src/shared/SiteNav'
// `lootData`, not `lootPrio`: on a case-insensitive filesystem the latter would
// resolve to this very component (`LootPrio.tsx`) and import undefined.
import { bossesOf, filterLoot, loadLootPrio, raidsOf } from './lootData'
import { LootPrioTable } from './LootPrioTable'
import type { LootPrioItem } from './types'

const SOURCE_URL = 'https://www.tbcguides.gg/p3-loot-prio/'

export function LootPrio({ initialItems }: { initialItems?: LootPrioItem[] }) {
  const [items, setItems] = useState<LootPrioItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState(initialItems === undefined)
  const [query, setQuery] = useState('')
  const [raid, setRaid] = useState('')
  const [boss, setBoss] = useState('')

  // The list is a lazy chunk (see `loadLootPrio`), so it arrives after first
  // paint. Tests pass `initialItems` and skip the fetch entirely.
  useEffect(() => {
    if (initialItems) return
    let cancelled = false
    loadLootPrio().then((loaded) => {
      if (cancelled) return
      setItems(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialItems])

  const raids = useMemo(() => raidsOf(items), [items])
  const bosses = useMemo(() => bossesOf(items, raid), [items, raid])

  // Picking a raid can strand a boss selection from the previous raid, which
  // would silently filter everything away. Drop it instead.
  const activeBoss = bosses.includes(boss) ? boss : ''

  const results = useMemo(
    () => filterLoot(items, { query, raid, boss: activeBoss }),
    [items, query, raid, activeBoss],
  )

  return (
    <main className="wide">
      <header>
        <SiteNav current="loot" />
        <h1>TBC Phase 3 Loot Priority</h1>
        <p className="stats">
          {loading ? (
            'Loading loot list…'
          ) : (
            <>
              {items.length} items · Black Temple, Mount Hyjal &amp; crafted · sourced from{' '}
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                tbcguides.gg
              </a>{' '}
              (last updated Jan 26th)
            </>
          )}
        </p>
      </header>

      <div className="filters">
        <input
          type="search"
          aria-label="Search loot"
          placeholder="Search item, boss or spec…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Filter by raid" value={raid} onChange={(e) => setRaid(e.target.value)}>
          <option value="">All sources</option>
          {raids.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by boss"
          value={activeBoss}
          onChange={(e) => setBoss(e.target.value)}
        >
          <option value="">All bosses</option>
          {bosses.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <p className="count">
        Showing {results.length} of {items.length}
      </p>

      <LootPrioTable items={results} />
    </main>
  )
}
