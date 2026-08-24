interface FiltersProps {
  query: string
  onQueryChange: (value: string) => void
  profession: string
  onProfessionChange: (value: string) => void
  crafter: string
  onCrafterChange: (value: string) => void
  professions: string[]
  crafters: string[]
}

export function Filters(props: FiltersProps) {
  return (
    <div className="filters">
      <input
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes…"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
      />
      <select
        aria-label="Filter by profession"
        value={props.profession}
        onChange={(e) => props.onProfessionChange(e.target.value)}
      >
        <option value="">All professions</option>
        {props.professions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by crafter"
        value={props.crafter}
        onChange={(e) => props.onCrafterChange(e.target.value)}
      >
        <option value="">All crafters</option>
        {props.crafters.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}
