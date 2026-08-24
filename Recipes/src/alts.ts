/**
 * Alt/main groupings — which characters are the same player.
 *
 * The table lists whoever can craft a recipe, but that character may be offline
 * while the player is on an alt. Each group below is one person's roster; the UI
 * shows a crafter's *other* characters in brackets so you can whisper an alt
 * instead. Add a member's whole roster as one array to wire them up everywhere.
 *
 * Names are matched case-insensitively (like the rest of the app) but
 * accent-sensitively, so `Slavongiga` and `Slavongîga` are listed separately and
 * both resolve to the same group.
 */
export const ALT_GROUPS: readonly (readonly string[])[] = [
  ['Slavongiga', 'Slavongîga', 'Slavon'],
  ['Evonte', 'Cassyette', 'Enevalake'],
  ['Arnsgar', 'Rollø'],
  ['Tehtree', 'Quelystia'],
  ['Sladkakurva', 'Alakay', 'Kurvovoyajer'],
  ['Benteha', 'Stodola'],
  ['Stratokaster', 'Jakanis', 'Moonak', 'Paliy'],
  ['Dantalionax', 'Zoorion', 'Turkey'],
  ['Pixelfarmer', 'Viletimes'],
  ['Firerocket', 'Roocket'],
  ['Dmze', 'Dmzi', 'Donchi'],
]

const key = (name: string) => name.trim().toLowerCase()

/** name → the full roster it belongs to (first group wins on any accidental dup). */
const groupByName = new Map<string, readonly string[]>()
for (const group of ALT_GROUPS) {
  for (const name of group) {
    if (!groupByName.has(key(name))) groupByName.set(key(name), group)
  }
}

/**
 * The other characters played by whoever plays `name`, in roster order. Empty
 * when the name has no known alts. The name itself is excluded (matched
 * case-insensitively), so the displayed crafter is never repeated in its own
 * bracket.
 */
export function relatedAlts(name: string): string[] {
  const group = groupByName.get(key(name))
  if (!group) return []
  return group.filter((n) => key(n) !== key(name))
}
