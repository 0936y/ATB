import type { RecipeMatch } from '../types'
import { wowheadUrl } from '../search'
import { armoryUrl } from '../armory'
import { relatedAlts } from '../alts'
import { useWowheadTooltips } from '../../../src/shared/wowhead'

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
              {match.crafters.map((crafter, i) => {
                const alts = relatedAlts(crafter)
                return (
                  <span key={crafter}>
                    {i > 0 && ', '}
                    <a href={armoryUrl(crafter)} target="_blank" rel="noreferrer">
                      {crafter}
                    </a>
                    {alts.length > 0 && (
                      <span className="alts">
                        {' ['}
                        {alts.map((alt, j) => (
                          <span key={alt}>
                            {j > 0 && ', '}
                            <a href={armoryUrl(alt)} target="_blank" rel="noreferrer">
                              {alt}
                            </a>
                          </span>
                        ))}
                        {']'}
                      </span>
                    )}
                  </span>
                )
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
