/**
 * Classic Armory profile links.
 *
 * URL shape: https://classic-armory.org/character/<region>/<version>/<realm>/<Name>
 *
 * The guild all sits on one realm, so region/version/realm are constants here and
 * only the character name varies. Change them in one place if the guild moves or
 * the app is reused for another server.
 */
export const ARMORY_REGION = 'eu'
export const ARMORY_VERSION = 'tbc-anniversary'
export const ARMORY_REALM = 'spineshatter'

export const ARMORY_BASE = `https://classic-armory.org/character/${ARMORY_REGION}/${ARMORY_VERSION}/${ARMORY_REALM}`

/**
 * Build the armory URL for a character.
 *
 * The name is percent-encoded because guild names contain non-ASCII characters
 * (e.g. `Slavongîga` → `Slavong%C3%AEga`), which would otherwise produce a
 * malformed URL.
 */
export function armoryUrl(crafter: string): string {
  return `${ARMORY_BASE}/${encodeURIComponent(crafter.trim())}`
}
