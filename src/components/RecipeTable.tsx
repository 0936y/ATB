import type { RecipeMatch } from '../types'
import { wowheadUrl } from '../search'
import { armoryUrl } from '../armory'
import { useWowheadTooltips } from '../wowhead'

export function RecipeTable({ matches }: { matches: RecipeMatch[] }) {
  // Rows are swapped out on every filter change, so re-attach tooltips.
  useWowheadTooltips(matches)

  if (matches.length === 0) {
    return <p className="empty">No recipes match those filters.</p>
  }

  return (
    <table className="recipes">
      <thead>
        <tr>
          <th>Recipe</th>
          <th>Profession</th>
          <th>Who can craft it</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match) => (
          <tr key={`${match.profession}-${match.id}`}>
            <td>
              <a href={wowheadUrl(match.id, match.profession)} target="_blank" rel="noreferrer">
                {match.name}
              </a>
            </td>
            <td>{match.profession}</td>
            <td className="crafters">
              {match.crafters.map((crafter, i) => (
                <span key={crafter}>
                  {i > 0 && ', '}
                  <a href={armoryUrl(crafter)} target="_blank" rel="noreferrer">
                    {crafter}
                  </a>
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
