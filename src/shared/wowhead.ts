import { useEffect } from 'react'

declare global {
  interface Window {
    $WowheadPower?: { refreshLinks: () => void }
  }
}

/**
 * Re-scan the DOM for Wowhead links after a render.
 *
 * `power.js` only walks the document once on load. Because filtering swaps the
 * table's rows out, links rendered afterwards get no tooltip unless we ask it to
 * look again.
 *
 * No-ops when the script is absent — offline, blocked by an ad blocker, or under
 * jsdom in tests.
 */
export function useWowheadTooltips(dependency: unknown): void {
  useEffect(() => {
    window.$WowheadPower?.refreshLinks()
  }, [dependency])
}
