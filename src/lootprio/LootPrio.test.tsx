import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LootPrio } from './LootPrio'
import type { LootPrioItem } from './types'

const items: LootPrioItem[] = [
  {
    name: 'Cuffs of Devastation',
    itemId: 30870,
    quality: 4,
    raid: 'Mount Hyjal',
    boss: 'Rage Winterchill',
    prio: ['Arcane', 'Balance', 'Ele'],
    notes: '',
  },
  {
    name: 'Warglaive of Azzinoth (MH/OH Set)',
    itemId: 32837,
    quality: 5,
    raid: 'Black Temple',
    boss: 'Illidan Stormrage',
    prio: ['Rogue'],
    notes: 'Legendary.',
  },
  {
    name: 'Belt of Deep Shadow',
    itemId: 32586,
    quality: 4,
    raid: 'Crafted',
    boss: '',
    prio: [],
    notes: '',
  },
]

function rows() {
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1) // drop the header row
}

describe('LootPrio', () => {
  it('renders every item with a count summary', () => {
    render(<LootPrio initialItems={items} />)

    expect(rows()).toHaveLength(3)
    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument()
  })

  it('links each item to its Wowhead TBC item page', () => {
    render(<LootPrio initialItems={items} />)

    expect(screen.getByRole('link', { name: 'Cuffs of Devastation' })).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/item=30870',
    )
  })

  // The source list appends context to some names ("(MH/OH Set)", "(speedrun)").
  // `renameLinks` is off, so that text has to survive into the DOM verbatim.
  it('keeps the source list’s wording on the link text', () => {
    render(<LootPrio initialItems={items} />)

    expect(
      screen.getByRole('link', { name: 'Warglaive of Azzinoth (MH/OH Set)' }),
    ).toBeInTheDocument()
  })

  it('colours the item cell by quality so it reads right without power.js', () => {
    render(<LootPrio initialItems={items} />)

    const legendary = screen.getByRole('link', { name: /Warglaive/ }).closest('td')
    expect(legendary).toHaveClass('q5')
  })

  it('numbers the priority list in order', () => {
    render(<LootPrio initialItems={items} />)

    const cuffs = screen.getByRole('link', { name: 'Cuffs of Devastation' }).closest('tr')!
    const ranked = within(cuffs).getAllByRole('listitem')
    expect(ranked.map((li) => li.textContent)).toEqual(['1Arcane', '2Balance', '3Ele'])
  })

  it('narrows by a spec typed into the search box', async () => {
    const user = userEvent.setup()
    render(<LootPrio initialItems={items} />)

    await user.type(screen.getByLabelText('Search loot'), 'balance')

    expect(rows()).toHaveLength(1)
    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument()
  })

  it('filters by raid, and scopes the boss dropdown to it', async () => {
    const user = userEvent.setup()
    render(<LootPrio initialItems={items} />)

    await user.selectOptions(screen.getByLabelText('Filter by raid'), 'Mount Hyjal')

    expect(rows()).toHaveLength(1)
    const bossOptions = within(screen.getByLabelText('Filter by boss')).getAllByRole('option')
    expect(bossOptions.map((o) => o.textContent)).toEqual(['All bosses', 'Rage Winterchill'])
  })

  // Switching raids used to strand the old boss selection and filter the table
  // down to nothing, which reads as a broken page rather than a stale filter.
  it('drops a boss selection that the newly picked raid does not have', async () => {
    const user = userEvent.setup()
    render(<LootPrio initialItems={items} />)

    await user.selectOptions(screen.getByLabelText('Filter by boss'), 'Rage Winterchill')
    expect(rows()).toHaveLength(1)

    await user.selectOptions(screen.getByLabelText('Filter by raid'), 'Black Temple')
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Warglaive/ })).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<LootPrio initialItems={items} />)

    await user.type(screen.getByLabelText('Search loot'), 'zzzzz')

    expect(screen.getByText('No items match those filters.')).toBeInTheDocument()
  })

  it('refreshes Wowhead tooltips when the visible rows change', async () => {
    const refreshLinks = vi.fn()
    window.$WowheadPower = { refreshLinks }

    const user = userEvent.setup()
    render(<LootPrio initialItems={items} />)
    refreshLinks.mockClear()

    await user.type(screen.getByLabelText('Search loot'), 'balance')

    expect(refreshLinks).toHaveBeenCalled()
    delete window.$WowheadPower
  })

  it('renders fine when power.js is absent (blocked or offline)', () => {
    delete window.$WowheadPower
    expect(() => render(<LootPrio initialItems={items} />)).not.toThrow()
  })

  it('links back to the recipe registry from the header', () => {
    render(<LootPrio initialItems={items} />)

    expect(screen.getByRole('link', { name: 'Recipe Registry' })).toHaveAttribute('href', '../')
  })
})
