/** A single craftable recipe known by a character. */
export interface Recipe {
  name: string
  /** WoW spell ID — the number after `#` in the export. */
  id: number
}

/** One character's recipe list for one profession, after merging all chunks. */
export interface CrafterProfession {
  crafter: string
  profession: string
  recipes: Recipe[]
}

/** Result of parsing a single export chunk. */
export interface ParsedChunk extends CrafterProfession {
  /** Lines that could not be understood. Never throws — collects instead. */
  warnings: string[]
}

/** A search hit: one recipe plus everyone who can craft it. */
export interface RecipeMatch {
  name: string
  id: number
  profession: string
  crafters: string[]
}
