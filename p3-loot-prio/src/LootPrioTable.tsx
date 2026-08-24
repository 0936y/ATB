import { wowheadItemUrl } from '../../src/shared/wowheadLinks'
import { useWowheadTooltips } from '../../src/shared/wowhead'
import type { LootPrioItem } from './types'

export function LootPrioTable({ items }: { items: LootPrioItem[] }) {
  // Rows are swapped out on every filter change, so re-attach tooltips.
  useWowheadTooltips(items)

  if (items.length === 0) {
    return <p className="empty">No items match those filters.</p>
  }

  return (
    <table className="loot">
      <thead>
        <tr>
          <th>Item</th>
          <th>Source</th>
          <th>Priority</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={`${item.itemId}-${i}`}>
            {/* The quality class sits on the cell, not the link: the link inherits
                it, so Wowhead's own .q1–.q5 win once power.js loads and we still
                colour items correctly when it is blocked or offline. Same trick
                the recipe table uses for its gold fallback. */}
            <td className={`item q${item.quality}`}>
              <a href={wowheadItemUrl(item.itemId)} target="_blank" rel="noreferrer">
                {item.name}
              </a>
            </td>
            <td className="source">
              {item.boss ? <span className="boss">{item.boss}</span> : null}
              <span className="raid">{item.raid}</span>
            </td>
            <td className="prio">
              {item.prio.length === 0 ? (
                <span className="none">—</span>
              ) : (
                <ol>
                  {item.prio.map((spec, rank) => (
                    <li key={`${rank}-${spec}`}>
                      <span className="rank">{rank + 1}</span>
                      {spec}
                    </li>
                  ))}
                </ol>
              )}
            </td>
            <td className="notes">{item.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
