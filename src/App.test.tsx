import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import type { CrafterProfession } from './types'
import { importLine } from './test/fixtures'

const entries: CrafterProfession[] = [
  {
    crafter: 'Slavongiga',
    profession: 'Enchanting',
    recipes: [
      { name: 'Enchant Weapon - Sunfire', id: 27981 },
      { name: 'Enchant Gloves - Major Healing', id: 33999 },
    ],
  },
  {
    crafter: 'Slavongîga',
    profession: 'Jewelcrafting',
    recipes: [{ name: 'Brilliant Glass', id: 35945 }],
  },
]

function rows() {
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1) // drop the header row
}

describe('App', () => {
  it('renders every recipe and a stats summary', () => {
    render(<App initialEntries={entries} />)
    expect(screen.getByText('3 recipes · 2 crafters · 2 professions')).toBeInTheDocument()
    expect(rows()).toHaveLength(3)
  })

  it('links each recipe to Wowhead with the right entity kind', () => {
    render(<App initialEntries={entries} />)

    // Jewelcrafting exports item IDs …
    expect(screen.getByRole('link', { name: 'Brilliant Glass' })).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/item=35945',
    )
    // … while Enchanting exports spell IDs.
    expect(screen.getByRole('link', { name: 'Enchant Weapon - Sunfire' })).toHaveAttribute(
      'href',
      'https://www.wowhead.com/tbc/spell=27981',
    )
  })

  it('links every crafter name to their Classic Armory profile', () => {
    render(<App initialEntries={entries} />)

    expect(screen.getAllByRole('link', { name: 'Slavongiga' })[0]).toHaveAttribute(
      'href',
      'https://classic-armory.org/character/eu/tbc-anniversary/spineshatter/Slavongiga',
    )
    // Non-ASCII names must be encoded, not emitted raw.
    expect(screen.getByRole('link', { name: 'Slavongîga' })).toHaveAttribute(
      'href',
      'https://classic-armory.org/character/eu/tbc-anniversary/spineshatter/Slavong%C3%AEga',
    )
  })

  it('links each crafter separately when several share a recipe', () => {
    render(
      <App
        initialEntries={[
          { crafter: 'Alpha', profession: 'Alchemy', recipes: [{ name: 'Potion', id: 1 }] },
          { crafter: 'Beta', profession: 'Alchemy', recipes: [{ name: 'Potion', id: 1 }] },
        ]}
      />,
    )

    expect(rows()).toHaveLength(1) // one recipe row …
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument() // … two links
    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument()
  })

  it('narrows results as you type a search', async () => {
    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    await user.type(screen.getByLabelText('Search recipes'), 'sunfire')

    expect(rows()).toHaveLength(1)
    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument()
  })

  it('filters by profession', async () => {
    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    await user.selectOptions(screen.getByLabelText('Filter by profession'), 'Jewelcrafting')

    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Brilliant Glass' })).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    await user.type(screen.getByLabelText('Search recipes'), 'zzzzz')

    expect(screen.getByText('No recipes match those filters.')).toBeInTheDocument()
  })

  it('imports a pasted export into the session', async () => {
    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    await user.type(
      screen.getByLabelText('Export text'),
      importLine('Newguy', 'Tailoring', ['Bolt of Linen#2963']),
    )
    await user.click(screen.getByRole('button', { name: 'Parse' }))

    expect(screen.getByText(/1 crafter\/profession, 1 recipes/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add to session' }))

    expect(screen.getByText('4 recipes · 3 crafters · 3 professions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bolt of Linen' })).toBeInTheDocument()
  })

  it('refreshes Wowhead tooltips when the visible rows change', async () => {
    const refreshLinks = vi.fn()
    window.$WowheadPower = { refreshLinks }

    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    expect(refreshLinks).toHaveBeenCalled() // initial render
    refreshLinks.mockClear()

    await user.type(screen.getByLabelText('Search recipes'), 'sunfire')

    expect(refreshLinks).toHaveBeenCalled() // re-scanned after filtering
    delete window.$WowheadPower
  })

  it('renders fine when power.js is absent (blocked or offline)', () => {
    delete window.$WowheadPower
    expect(() => render(<App initialEntries={entries} />)).not.toThrow()
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('reports unparseable paste text instead of failing silently', async () => {
    const user = userEvent.setup()
    render(<App initialEntries={entries} />)

    await user.type(screen.getByLabelText('Export text'), 'not an export')
    await user.click(screen.getByRole('button', { name: 'Parse' }))

    expect(screen.getByText(/No valid .* payload found/)).toBeInTheDocument()
  })
})
